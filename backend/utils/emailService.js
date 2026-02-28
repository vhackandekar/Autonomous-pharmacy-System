const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com') {
        console.warn('⚠️ Email not sent: EMAIL_USER is not configured in .env');
        return { success: false, error: 'Email server not configured' };
    }

    try {
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"Pharmacy Intelligence" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent: ' + info.response);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail };
