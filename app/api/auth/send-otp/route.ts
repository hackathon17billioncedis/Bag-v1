import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateOTP, hashOTP, storeOTP } from '@/lib/auth';

type SendOTPRequest = {
  email: string;
};

export async function POST(request: Request) {
  let body: SendOTPRequest;

  try {
    body = (await request.json()) as SendOTPRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
  }

  try {
    // Generate OTP
    const otp = generateOTP();
    const hashedOtp = hashOTP(otp);

    // Store OTP temporarily
    storeOTP(body.email, hashedOtp);

    // Create transporter for sending emails
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // Using Gmail as the email service
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Email configuration
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: body.email,
      subject: 'Your OTP for Bag-v1 Login',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Login Verification</h2>
          <p>Hello,</p>
          <p>You have requested to log in to Bag-v1. Use the following One-Time Password (OTP) to complete your login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; font-size: 24px; font-weight: bold; padding: 10px 20px; background-color: #f0f0f0; border-radius: 5px; letter-spacing: 2px;">
              ${otp}
            </span>
          </div>
          <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          <hr style="margin: 30px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated message from Bag-v1. Please do not reply to this email.</p>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send OTP.' },
      { status: 500 }
    );
  }
}