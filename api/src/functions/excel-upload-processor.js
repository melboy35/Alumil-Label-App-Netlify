const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const sql = require('mssql');
const XLSX = require('xlsx');

/**
 * Excel Upload Processor Function
 * Handles direct file uploads to Azure Blob Storage and processes Excel data
 */
app.http('excel-upload-processor', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Excel upload processor triggered');

        try {
            // Get file data from request
            const contentType = request.headers.get('content-type');
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return {
                    status: 400,
                    jsonBody: { error: 'Content-Type must be multipart/form-data' }
                };
            }

            // Get the uploaded file buffer
            const fileBuffer = await request.arrayBuffer();
            const fileName = request.headers.get('x-file-name') || `upload_${Date.now()}.xlsx`;

            // Validate file type
            if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
                return {
                    status: 400,
                    jsonBody: { error: 'Only Excel files (.xlsx, .xls) are supported' }
                };
            }

            // Upload to Azure Blob Storage
            const credential = new DefaultAzureCredential();
            const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
            const blobServiceClient = new BlobServiceClient(
                `https://${storageAccountName}.blob.core.windows.net`,
                credential
            );

            const containerClient = blobServiceClient.getContainerClient('excel-uploads');
            const blobName = `${Date.now()}_${fileName}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            // Upload file
            await blockBlobClient.upload(fileBuffer, fileBuffer.byteLength, {
                blobHTTPHeaders: {
                    blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            });

            // Process Excel file
            const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
            const processedData = await processExcelWorkbook(workbook);

            // Store data in Azure SQL Database
            await storeInventoryData(processedData, context);

            // Notify connected clients via SignalR (placeholder - implement with SignalR binding)
            await notifyClientsOfUpdate(processedData, context);

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'File uploaded and processed successfully',
                    fileName: fileName,
                    blobName: blobName,
                    recordsProcessed: {
                        profiles: processedData.profiles.length,
                        accessories: processedData.accessories.length
                    }
                }
            };

        } catch (error) {
            context.log.error('Error processing Excel upload:', error);
            return {
                status: 500,
                jsonBody: { 
                    error: 'Failed to process Excel upload', 
                    details: error.message 
                }
            };
        }
    }
});

/**
 * Process Excel workbook and extract data
 */
async function processExcelWorkbook(workbook) {
    const profiles = [];
    const accessories = [];

    // Find profiles and accessories sheets
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

/**
 * Find sheet by name patterns
 */
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

/**
 * Process profiles data from Excel
 */
function processProfilesData(rawData) {
    if (rawData.length === 0) return [];
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    return dataRows.map(row => {
        const profile = {
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
        };
        
        return profile;
    }).filter(item => item.code);
}

/**
 * Process accessories data from Excel
 */
function processAccessoriesData(rawData) {
    if (rawData.length === 0) return [];
    
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    return dataRows.map(row => {
        const accessory = {
            code: cleanString(row[findColumnIndex(headers, ['Code', 'Item Code', 'Accessory Code'])]),
            description: cleanString(row[findColumnIndex(headers, ['Description', 'Desc', 'Name'])]),
            unit: cleanString(row[findColumnIndex(headers, ['Unit', 'UOM'])]) || 'pcs',
            category: cleanString(row[findColumnIndex(headers, ['Category', 'Type'])]),
            warehouse_no: cleanString(row[findColumnIndex(headers, ['Warehouse', 'Warehouse No'])]),
            rack_no: cleanString(row[findColumnIndex(headers, ['Rack', 'Rack No'])]),
            quantity: parseNumber(row[findColumnIndex(headers, ['Quantity', 'Qty'])]) || 0
        };
        
        return accessory;
    }).filter(item => item.code);
}

/**
 * Store inventory data in Azure SQL Database
 */
async function storeInventoryData(data, context) {
    try {
        const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
        const pool = new sql.ConnectionPool(connectionString);
        await pool.connect();

        // Clear existing data and insert new data
        await pool.request().query('DELETE FROM inventory_profiles');
        await pool.request().query('DELETE FROM inventory_accessories');

        // Insert profiles
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

        // Insert accessories
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
        context.log('Successfully stored inventory data in SQL Database');

    } catch (error) {
        context.log.error('Error storing data in SQL Database:', error);
        throw error;
    }
}

/**
 * Notify connected clients of data update via SignalR
 */
async function notifyClientsOfUpdate(data, context) {
    // This will be implemented with SignalR output binding
    context.log('Data update notification triggered', {
        profiles: data.profiles.length,
        accessories: data.accessories.length
    });
}

/**
 * Utility functions
 */
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