const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file to Cloudinary and removes local file
 * @param {string} localFilePath 
 * @param {string} folder 
 * @returns {Promise<object>}
 */
const uploadToCloudinary = async (localFilePath, folder = 'prescriptions') => {
    try {
        if (!localFilePath) return null;
        const absolutePath = path.resolve(localFilePath);

        const response = await cloudinary.uploader.upload(absolutePath, {
            folder: folder,
            resource_type: 'auto'
        });

        // Delete local file after upload
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return {
            url: response.secure_url,
            publicId: response.public_id
        };
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        // Still remove local file if it exists even if upload failed
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        throw error;
    }
};

module.exports = { uploadToCloudinary };
