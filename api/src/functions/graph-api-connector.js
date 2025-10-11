const { app } = require('@azure/functions');
const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const sql = require('mssql');
const XLSX = require('xlsx');

/**
 * Microsoft Graph API Connector Function
 * Handles Excel file downloads from SharePoint and processing
 */
app.http('graph-api-connector', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Graph API connector triggered');

        try {
            const requestBody = await request.json();
            const { sharePointUrl, sitePath, fileName, accessToken } = requestBody;

            if (!sharePointUrl || !sitePath || !fileName || !accessToken) {
                return {
                    status: 400,
                    jsonBody: { 
                        error: 'Missing required parameters: sharePointUrl, sitePath, fileName, accessToken' 
                    }
                };
            }

            // Initialize Graph client with provided access token
            const graphClient = Client.init({
                authProvider: {
                    getAccessToken: async () => accessToken
                }
            });

            // Get SharePoint site
            const hostname = new URL(sharePointUrl).hostname;
            const site = await graphClient
                .api(`/sites/${hostname}:${sitePath}`)
                .get();

            // Search for the Excel file
            const searchResults = await graphClient
                .api(`/sites/${site.id}/drive/search(q='${fileName}')`)
                .get();

            if (!searchResults.value || searchResults.value.length === 0) {
                return {
                    status: 404,
                    jsonBody: { error: `File '${fileName}' not found in SharePoint` }
                };
            }

            // Get the first matching file
            const file = searchResults.value.find(f => f.name === fileName) || searchResults.value[0];

            // Download file content
            const fileContent = await graphClient
                .api(`/sites/${site.id}/drive/items/${file.id}/content`)
                .responseType('arraybuffer')
                .get();

            // Store file in Azure Blob Storage
            const credential = new DefaultAzureCredential();
            const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
            const blobServiceClient = new BlobServiceClient(
                `https://${storageAccountName}.blob.core.windows.net`,
                credential
            );

            const containerClient = blobServiceClient.getContainerClient('excel-uploads');
            const blobName = `sharepoint_${Date.now()}_${file.name}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            await blockBlobClient.upload(fileContent, fileContent.byteLength, {
                blobHTTPHeaders: {
                    blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                },
                metadata: {
                    source: 'SharePoint Graph API',
                    originalUrl: file.webUrl,
                    lastModified: file.lastModifiedDateTime
                }
            });

            // Process Excel file
            const workbook = XLSX.read(new Uint8Array(fileContent), { type: 'array' });
            const processedData = await processExcelWorkbook(workbook);

            // Store data in Azure SQL Database
            await storeInventoryData(processedData, context);

            // Notify connected clients
            await notifyClientsOfUpdate(processedData, context);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'SharePoint file downloaded and processed successfully',
                    fileName: file.name,
                    blobName: blobName,
                    fileSize: file.size,
                    lastModified: file.lastModifiedDateTime,
                    recordsProcessed: {
                        profiles: processedData.profiles.length,
                        accessories: processedData.accessories.length
                    }
                }
            };

        } catch (error) {
            context.log.error('Error in Graph API connector:', error);
            return {
                status: 500,
                jsonBody: { 
                    error: 'Failed to process SharePoint file', 
                    details: error.message 
                }
            };
        }
    }
});

/**
 * List SharePoint files function
 */
app.http('graph-api-list-files', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            const requestBody = await request.json();
            const { sharePointUrl, sitePath, accessToken, searchQuery = '*.xlsx' } = requestBody;

            const graphClient = Client.init({
                authProvider: {
                    getAccessToken: async () => accessToken
                }
            });

            const hostname = new URL(sharePointUrl).hostname;
            const site = await graphClient
                .api(`/sites/${hostname}:${sitePath}`)
                .get();

            // Search for Excel files
            const searchResults = await graphClient
                .api(`/sites/${site.id}/drive/search(q='${searchQuery}')`)
                .get();

            const files = searchResults.value
                .filter(file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))
                .map(file => ({
                    id: file.id,
                    name: file.name,
                    size: file.size,
                    lastModified: file.lastModifiedDateTime,
                    webUrl: file.webUrl,
                    downloadUrl: file['@microsoft.graph.downloadUrl']
                }));

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    files: files,
                    total: files.length
                }
            };

        } catch (error) {
            context.log.error('Error listing SharePoint files:', error);
            return {
                status: 500,
                jsonBody: { 
                    error: 'Failed to list SharePoint files', 
                    details: error.message 
                }
            };
        }
    }
});

// Reuse utility functions from excel-upload-processor
async function processExcelWorkbook(workbook) {
    const profiles = [];
    const accessories = [];

    const profilesSheet = findSheet(workbook, ['profiles', 'profile', 'prof']);
    const accessoriesSheet = findSheet(workbook, ['accessories', 'accessory', 'acc']);

    if (profilesSheet) {
        const profileData = XLSX.utils.sheet_to_json(workbook.Sheets[profilesSheet], { header: 1 });
        profiles.push(...processProfilesData(profileData));
    }

    if (accessoriesSheet) {
        const accessoryData = XLSX.utils.sheet_to_json(workbook.Sheets[accessoriesSheet], { header: 1 });
        accessories.push(...processAccessoriesData(accessoryData));
    }

    return { profiles, accessories };
}

function findSheet(workbook, patterns) {
    const sheetNames = workbook.SheetNames;
    for (const pattern of patterns) {
        const found = sheetNames.find(name => 
            name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (found) return found;
    }
    return sheetNames[patterns.includes('prof') ? 0 : 1];
}

function processProfilesData(rawData) {
    if (rawData.length === 0) return [];
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    return dataRows.map(row => ({
        code: cleanString(row[findColumnIndex(headers, ['Code', 'Item Code', 'Profile Code'])]),
        description: cleanString(row[findColumnIndex(headers, ['Description', 'Desc', 'Name'])]),
        length: parseNumber(row[findColumnIndex(headers, ['Length', 'Len'])]),
        color: cleanString(row[findColumnIndex(headers, ['Color', 'Colour'])]),
        alloy: cleanString(row[findColumnIndex(headers, ['Alloy'])]),
        system: cleanString(row[findColumnIndex(headers, ['System'])]),
        warehouse_no: cleanString(row[findColumnIndex(headers, ['Warehouse', 'Warehouse No'])]),
        rack_no: cleanString(row[findColumnIndex(headers, ['Rack', 'Rack No'])]),
        quantity: parseNumber(row[findColumnIndex(headers, ['Quantity', 'Qty'])]) || 0,
        unit: cleanString(row[findColumnIndex(headers, ['Unit', 'UOM'])]) || 'pcs'
    })).filter(item => item.code);
}

function processAccessoriesData(rawData) {
    if (rawData.length === 0) return [];
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    return dataRows.map(row => ({
        code: cleanString(row[findColumnIndex(headers, ['Code', 'Item Code', 'Accessory Code'])]),
        description: cleanString(row[findColumnIndex(headers, ['Description', 'Desc', 'Name'])]),
        unit: cleanString(row[findColumnIndex(headers, ['Unit', 'UOM'])]) || 'pcs',
        category: cleanString(row[findColumnIndex(headers, ['Category', 'Type'])]),
        warehouse_no: cleanString(row[findColumnIndex(headers, ['Warehouse', 'Warehouse No'])]),
        rack_no: cleanString(row[findColumnIndex(headers, ['Rack', 'Rack No'])]),
        quantity: parseNumber(row[findColumnIndex(headers, ['Quantity', 'Qty'])]) || 0
    })).filter(item => item.code);
}

async function storeInventoryData(data, context) {
    try {
        const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
        const pool = new sql.ConnectionPool(connectionString);
        await pool.connect();

        await pool.request().query('DELETE FROM inventory_profiles');
        await pool.request().query('DELETE FROM inventory_accessories');

        for (const profile of data.profiles) {
            await pool.request()
                .input('code', sql.VarChar, profile.code)
                .input('description', sql.VarChar, profile.description)
                .input('length', sql.Float, profile.length)
                .input('color', sql.VarChar, profile.color)
                .input('alloy', sql.VarChar, profile.alloy)
                .input('system', sql.VarChar, profile.system)
                .input('warehouse_no', sql.VarChar, profile.warehouse_no)
                .input('rack_no', sql.VarChar, profile.rack_no)
                .input('quantity', sql.Int, profile.quantity)
                .input('unit', sql.VarChar, profile.unit)
                .query(`
                    INSERT INTO inventory_profiles 
                    (code, description, length, color, alloy, system, warehouse_no, rack_no, quantity, unit, created_at)
                    VALUES (@code, @description, @length, @color, @alloy, @system, @warehouse_no, @rack_no, @quantity, @unit, GETDATE())
                `);
        }

        for (const accessory of data.accessories) {
            await pool.request()
                .input('code', sql.VarChar, accessory.code)
                .input('description', sql.VarChar, accessory.description)
                .input('unit', sql.VarChar, accessory.unit)
                .input('category', sql.VarChar, accessory.category)
                .input('warehouse_no', sql.VarChar, accessory.warehouse_no)
                .input('rack_no', sql.VarChar, accessory.rack_no)
                .input('quantity', sql.Int, accessory.quantity)
                .query(`
                    INSERT INTO inventory_accessories 
                    (code, description, unit, category, warehouse_no, rack_no, quantity, created_at)
                    VALUES (@code, @description, @unit, @category, @warehouse_no, @rack_no, @quantity, GETDATE())
                `);
        }

        await pool.close();
        context.log('Successfully stored inventory data from SharePoint');

    } catch (error) {
        context.log.error('Error storing SharePoint data:', error);
        throw error;
    }
}

async function notifyClientsOfUpdate(data, context) {
    context.log('SharePoint data update notification triggered', {
        profiles: data.profiles.length,
        accessories: data.accessories.length
    });
}

function cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
}

function findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
        const index = headers.findIndex(header => 
            header && header.toString().toLowerCase().trim() === name.toLowerCase()
        );
        if (index !== -1) return index;
    }
    return -1;
}