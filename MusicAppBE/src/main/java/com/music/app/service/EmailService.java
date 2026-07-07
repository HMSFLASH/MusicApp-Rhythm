package com.music.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.beans.factory.annotation.Autowired;

@Service
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String senderEmail;

    public void sendPasswordResetEmail(String to, String resetLink) {
        String htmlBody = "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "    <meta charset=\"UTF-8\">\n" +
                "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "    <title>Reset Your Password - SonicDepth</title>\n" +
                "    <style>\n" +
                "        body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050914; color: #ffffff; -webkit-font-smoothing: antialiased; }\n" +
                "        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }\n" +
                "        .card { background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 40px; text-align: center; }\n" +
                "        .logo { width: 48px; height: 48px; background-color: rgba(0, 229, 255, 0.1); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; }\n" +
                "        .logo-icon { color: #00E5FF; font-size: 24px; font-weight: bold; }\n" +
                "        h1 { font-size: 24px; font-weight: 700; margin: 0 0 16px; color: #ffffff; }\n" +
                "        p { font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.6); margin: 0 0 32px; }\n" +
                "        .btn { display: inline-block; background-color: #00E5FF; color: #000000; font-weight: 700; font-size: 16px; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 0 20px rgba(0, 229, 255, 0.3); margin-bottom: 32px; }\n" +
                "        .footer { margin-top: 40px; font-size: 12px; color: rgba(255, 255, 255, 0.3); text-align: center; }\n" +
                "        .link { color: #00E5FF; text-decoration: none; }\n" +
                "    </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "    <div class=\"container\">\n" +
                "        <div class=\"card\">\n" +
                "            <div class=\"logo\">\n" +
                "                <span class=\"logo-icon\">SD</span>\n" +
                "            </div>\n" +
                "            <h1>Password Reset Request</h1>\n" +
                "            <p>\n" +
                "                We received a request to reset the password for your SonicDepth account. \n" +
                "                If you didn't make this request, you can safely ignore this email.\n" +
                "            </p>\n" +
                "            <a href=\"" + resetLink + "\" class=\"btn\">Reset Password</a>\n" +
                "            <p style=\"font-size: 13px; margin-bottom: 0;\">\n" +
                "                Or copy and paste this link into your browser:<br>\n" +
                "                <a href=\"" + resetLink + "\" class=\"link\">" + resetLink + "</a>\n" +
                "            </p>\n" +
                "        </div>\n" +
                "        <div class=\"footer\">\n" +
                "            &copy; 2026 SonicDepth. All rights reserved.<br>\n" +
                "            This link will expire in 15 minutes.\n" +
                "        </div>\n" +
                "    </div>\n" +
                "</body>\n" +
                "</html>";

        // Check if mail is configured, otherwise fallback to console
        if (mailSender == null || senderEmail == null || senderEmail.trim().isEmpty()) {
            log.info("\n========================================================\n" +
                    "SMTP is not configured. Email to {} has been mocked.\n" +
                    "RESET LINK: {}\n" +
                    "========================================================", to, resetLink);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setFrom(senderEmail);
            helper.setTo(to);
            helper.setSubject("Reset Your Password - SonicDepth");
            helper.setText(htmlBody, true);
            
            mailSender.send(message);
            log.info("Password reset email sent successfully to {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}", to, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }
}
