const functions = require('firebase-functions');
const {RecaptchaEnterpriseServiceClient} = require('@google-cloud/recaptcha-enterprise');

const client = new RecaptchaEnterpriseServiceClient();

exports.verifyRecaptcha = functions.https.onCall(async (data, context) => {
  const projectID = "it-inventory-eaebc";
  const recaptchaKey = "6Ld_kNMrAAAAAIYoB4JC9Cz5dl2xAcSJZ_rlP80j";
  const token = data.token;
  const recaptchaAction = data.action || "LOGIN";

  const projectPath = client.projectPath(projectID);

  const request = {
    assessment: {
      event: {
        token: token,
        siteKey: recaptchaKey,
      },
    },
    parent: projectPath,
  };

  try {
    const [response] = await client.createAssessment(request);

    if (!response.tokenProperties.valid) {
      console.log(`Token invalid: ${response.tokenProperties.invalidReason}`);
      return { success: false, reason: response.tokenProperties.invalidReason };
    }

    if (response.tokenProperties.action === recaptchaAction) {
      const score = response.riskAnalysis.score;
      console.log(`reCAPTCHA score: ${score}`);

      // Consider scores above 0.5 as legitimate
      return {
        success: score > 0.5,
        score: score,
        reasons: response.riskAnalysis.reasons
      };
    } else {
      return { success: false, reason: "Action mismatch" };
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, reason: error.message };
  }
});