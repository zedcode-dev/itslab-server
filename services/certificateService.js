// ============================================================================
// SERVICES/CERTIFICATE_SERVICE.JS - Certificate Generation
// ============================================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Enrollment, User, Course, Certificate } = require('../models');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');

// Ensure certificates directory exists
const CERTIFICATE_DIR = path.join(process.cwd(), 'public/uploads/certificates');
if (!fs.existsSync(CERTIFICATE_DIR)) {
  fs.mkdirSync(CERTIFICATE_DIR, { recursive: true });
}

/**
 * Generate unique certificate ID
 */
function generateCertificateId() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `CERT-${year}-${random}`;
}

/**
 * Generate certificate PDF
 * @param {Object} data - Certificate data
 * @returns {Buffer} PDF buffer
 */
async function generateCertificatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', reject);

    // Certificate design
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Border
    doc
      .rect(30, 30, pageWidth - 60, pageHeight - 60)
      .lineWidth(3)
      .stroke('#2196F3');

    // Title
    doc
      .fontSize(48)
      .font('Helvetica-Bold')
      .fillColor('#2196F3')
      .text('Certificate of Completion', 0, 100, {
        align: 'center',
        width: pageWidth,
      });

    // Subtitle
    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#666666')
      .text('This is to certify that', 0, 180, {
        align: 'center',
        width: pageWidth,
      });

    // Student name
    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(data.studentName, 0, 220, {
        align: 'center',
        width: pageWidth,
      });

    // Course info
    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#666666')
      .text('has successfully completed the course', 0, 280, {
        align: 'center',
        width: pageWidth,
      });

    // Course name
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#2196F3')
      .text(data.courseName, 0, 320, {
        align: 'center',
        width: pageWidth,
      });

    // Date
    const dateStr = new Date(data.completionDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Completed on ${dateStr}`, 0, 400, {
        align: 'center',
        width: pageWidth,
      });

    // Certificate ID
    doc
      .fontSize(12)
      .fillColor('#999999')
      .text(`Certificate ID: ${data.certificateId}`, 0, 430, {
        align: 'center',
        width: pageWidth,
      });

    // Instructor signature
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(data.instructorName, 0, 500, {
        align: 'center',
        width: pageWidth,
      });

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Course Instructor', 0, 525, {
        align: 'center',
        width: pageWidth,
      });

    // ITSLab branding
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#2196F3')
      .text('ITSLab', 0, pageHeight - 80, {
        align: 'center',
        width: pageWidth,
      });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#999999')
      .text('Online Learning Platform', 0, pageHeight - 60, {
        align: 'center',
        width: pageWidth,
      });

    doc.end();
  });
}

/**
 * Save certificate to local storage
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} filename - Filename
 * @returns {string} Local URL
 */
async function saveCertificateLocally(pdfBuffer, filename) {
  const filePath = path.join(CERTIFICATE_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);
  return `/uploads/certificates/${filename}`;
}

/**
 * Generate certificate for completed enrollment
 * @param {string} enrollmentId - Enrollment ID
 * @returns {Object} Certificate record
 */
async function generateCertificate(enrollmentId) {
  try {
    // Get enrollment with related data
    const enrollment = await Enrollment.findByPk(enrollmentId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title'],
          include: [
            {
              model: User,
              as: 'instructor',
              attributes: ['name'],
            },
          ],
        },
      ],
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    if (!enrollment.completed) {
      throw new Error('Course not completed yet');
    }

    // Check if certificate already exists
    const existingCertificate = await Certificate.findOne({
      where: { enrollment_id: enrollmentId },
    });

    if (existingCertificate) {
      return existingCertificate;
    }

    // Generate certificate data
    const certificateId = generateCertificateId();
    const certificateData = {
      studentName: enrollment.user.name,
      courseName: enrollment.course.title,
      completionDate: enrollment.completion_date,
      certificateId,
      instructorName: enrollment.course.instructor.name,
    };

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF(certificateData);

    // Save locally
    const filename = `${certificateId}.pdf`;
    const certificateUrl = await saveCertificateLocally(pdfBuffer, filename);

    // Save certificate record
    const certificate = await Certificate.create({
      enrollment_id: enrollmentId,
      user_id: enrollment.user_id,
      course_id: enrollment.course_id,
      certificate_id: certificateId,
      certificate_url: certificateUrl,
      issued_date: new Date(),
    });

    // Update enrollment
    await enrollment.update({
      certificate_url: certificateUrl,
      certificate_id: certificateId,
    });

    // Send email notification
    await sendEmail({
      to: enrollment.user.email,
      subject: 'Your Course Certificate is Ready!',
      template: 'course-completion',
      data: {
        studentName: enrollment.user.name,
        courseName: enrollment.course.title,
        certificateUrl,
      },
    });

    logger.info(`Certificate generated: ${certificateId} for enrollment ${enrollmentId}`);

    return certificate;
  } catch (error) {
    logger.error('Certificate generation failed:', error);
    throw error;
  }
}

module.exports = {
  generateCertificate,
};
