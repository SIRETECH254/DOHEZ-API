import cloudinary from '../config/cloudinary';
import { generateTicketPDF } from './generatePDF';

/**
 * Generates and uploads a ticket PDF to Cloudinary
 * @param ticket The ticket object with populated event data and QR code
 * @returns The secure URL of the uploaded PDF
 */
export const uploadTicketPDF = async (ticket: any): Promise<string> => {
    try {
        // Generate PDF
        const pdfBuffer = await generateTicketPDF(ticket);

        // Upload PDF to Cloudinary as raw file using stream
        const fileName = `ticket-${ticket.ticketNumber || ticket._id}.pdf`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string; version?: number }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'dohez/tickets',
                    resource_type: 'raw',
                    public_id: fileName,
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || '',
                            version: result.version
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        let pdfUrl = uploadResult.secure_url;
        
        if (!pdfUrl) {
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const publicId = uploadResult.public_id || `dohez/tickets/${fileName}`;
            const version = uploadResult.version ? `v${uploadResult.version}/` : '';
            const finalPublicId = publicId.endsWith('.pdf') ? publicId : `${publicId}.pdf`;
            pdfUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${version}${finalPublicId}`;
        } else {
            const urlParts = pdfUrl.split('?');
            const urlWithoutQuery = urlParts[0];
            if (urlWithoutQuery && !urlWithoutQuery.toLowerCase().endsWith('.pdf')) {
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl = `${pdfUrl}.pdf`;
                }
            }
        }

        return pdfUrl;
    } catch (error: any) {
        console.error('Error uploading ticket PDF:', error);
        throw error;
    }
};
