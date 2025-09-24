// Simple reCAPTCHA verification script
// Run with: node verify-recaptcha.js

const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

async function verifyToken() {
    // Fresh token from reCAPTCHA test
    const token = "HFMXBsIglKSykQGmdZH1pIHhwHbBdqOAJiRzJuZy1peQk2WgwTXEElU3oyLipMcB01Wg9dVQMfGEVRGGwLNnsKOnUzNlJkcXoAN0RHBQF5NFQ8dHh0FHsWaHhINxxEHkdIFl1sAT0LBSxNbndOeHAmVSF8XhgBdyhweAlJcGp6KXNSTm5nQ1diNFgBZwEXXgFnVzgaZTlsCl96DlYTXEEyUXhsa2MSFh4yTw0uVQRp";

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