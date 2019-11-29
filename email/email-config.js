module.exports = () => {
    const emailConfig = {
      apiKey: process.env.MAIL_GUN_API_KEY,
      domain: process.env.MAIL_GUN_DOMAIN
    };
  return emailConfig;
  };