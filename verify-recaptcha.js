// Simple reCAPTCHA verification script
// Run with: node verify-recaptcha.js

const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

async function verifyToken() {
    // Replace this with the actual token from your test
    const token = "HFa3Y2eA8QES9KQGEDRV"; // Use your actual full token

    const client = new RecaptchaEnterpriseServiceClient();
    const projectPath = client.projectPath("it-inventory-eaebc");

    const request = {
        assessment: {
            event: {
                token: token,
                siteKey: "6Ld_kNMrAAAAAIYoB4JC9Cz5dl2xAcSJZ_rlP80j",
            },
        },
        parent: projectPath,
    };

    try {
        const [response] = await client.createAssessment(request);

        console.log('Token valid:', response.tokenProperties.valid);
        console.log('Action:', response.tokenProperties.action);
        console.log('Score:', response.riskAnalysis.score);
        console.log('Reasons:', response.riskAnalysis.reasons);

        return response;
    } catch (error) {
        console.error('Verification error:', error);
    }
}

verifyToken();