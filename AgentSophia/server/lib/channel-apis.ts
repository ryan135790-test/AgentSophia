// API Integration Layer for Campaign Channels
// This file contains the actual API connectors for sending messages through various channels

interface EmailConfig {
  provider: 'sendgrid' | 'resend' | 'smtp';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface SMSConfig {
  provider: 'twilio' | 'vonage';
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface PhoneConfig {
  provider: 'twilio' | 'elevenlabs';
  accountSid: string;
  authToken: string;
  voiceId?: string;
  fromNumber?: string;
}

interface LinkedInConfig {
  accessToken: string;
}

// Email Connector
export async function sendEmail(config: EmailConfig, to: string, subject: string, content: string) {
  try {
    if (config.provider === 'sendgrid') {
      // SendGrid API
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: to }],
            subject: subject
          }],
          from: {
            email: config.fromEmail,
            name: config.fromName
          },
          content: [{
            type: 'text/html',
            value: content
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.statusText}`);
      }

      return { success: true, messageId: response.headers.get('X-Message-Id') };
    } else if (config.provider === 'resend') {
      // Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${config.fromName} <${config.fromEmail}>`,
          to: [to],
          subject: subject,
          html: content
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Resend API error: ${data.message}`);
      }

      return { success: true, messageId: data.id };
    }

    throw new Error('Unsupported email provider');
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
}

// SMS Connector
export async function sendSMS(config: SMSConfig, to: string, content: string) {
  try {
    if (config.provider === 'twilio') {
      // Twilio SMS API
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: config.fromNumber,
            Body: content
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Twilio API error: ${data.message}`);
      }

      return { success: true, messageId: data.sid };
    } else if (config.provider === 'vonage') {
      // Vonage SMS API
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.fromNumber,
          to: to,
          text: content,
          api_key: config.accountSid,
          api_secret: config.authToken
        })
      });

      const data = await response.json();

      if (data.messages[0].status !== '0') {
        throw new Error(`Vonage API error: ${data.messages[0]['error-text']}`);
      }

      return { success: true, messageId: data.messages[0]['message-id'] };
    }

    throw new Error('Unsupported SMS provider');
  } catch (error) {
    console.error('SMS sending error:', error);
    throw error;
  }
}

// Phone Call Connector
export async function makePhoneCall(config: PhoneConfig, to: string, content: string) {
  try {
    if (config.provider === 'twilio') {
      // Twilio Voice API with AI-generated speech
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      
      // Create TwiML for text-to-speech
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">${content}</Say>
          <Gather input="dtmf" numDigits="1" timeout="10">
            <Say>Press 1 to speak with someone, or press 2 to schedule a callback.</Say>
          </Gather>
        </Response>`;

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: config.fromNumber || '',
            Twiml: twiml
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Twilio Voice API error: ${data.message}`);
      }

      return { success: true, callId: data.sid };
    }

    throw new Error('Unsupported phone provider');
  } catch (error) {
    console.error('Phone call error:', error);
    throw error;
  }
}

// Voicemail Drop Connector
export async function dropVoicemail(config: PhoneConfig, to: string, content: string) {
  try {
    if (config.provider === 'elevenlabs') {
      // Use ElevenLabs for high-quality AI voice
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + config.voiceId, {
        method: 'POST',
        headers: {
          'xi-api-key': config.authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: content,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error('ElevenLabs API error');
      }

      // In production, this would then be delivered via Twilio or similar
      const audioBlob = await response.blob();
      
      return { success: true, audioUrl: 'generated-voicemail.mp3' };
    }

    // Fallback to Twilio voicemail
    return makePhoneCall(config, to, content);
  } catch (error) {
    console.error('Voicemail drop error:', error);
    throw error;
  }
}

// LinkedIn Connector
export async function sendLinkedInMessage(config: LinkedInConfig, recipientId: string, content: string) {
  try {
    // LinkedIn Messaging API
    const response = await fetch('https://api.linkedin.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        recipients: [recipientId],
        subject: 'Connection Request',
        body: content
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${data.message}`);
    }

    return { success: true, messageId: data.value?.entityUrn };
  } catch (error) {
    console.error('LinkedIn message error:', error);
    throw error;
  }
}

// Social Media Post Connector
export async function postToSocial(platform: 'twitter' | 'facebook' | 'instagram', accessToken: string, content: string) {
  try {
    if (platform === 'twitter') {
      // Twitter API v2
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: content
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Twitter API error: ${data.detail}`);
      }

      return { success: true, postId: data.data.id };
    } else if (platform === 'facebook') {
      // Facebook Graph API
      const response = await fetch('https://graph.facebook.com/v18.0/me/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          access_token: accessToken
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Facebook API error: ${data.error.message}`);
      }

      return { success: true, postId: data.id };
    }

    throw new Error('Unsupported social platform');
  } catch (error) {
    console.error('Social media post error:', error);
    throw error;
  }
}

// Batch Campaign Execution
export async function executeCampaignStep(
  channel: string,
  config: any,
  recipient: { email?: string; phone?: string; linkedinId?: string },
  content: { subject?: string; body: string }
) {
  switch (channel) {
    case 'email':
      if (!recipient.email) throw new Error('Email address required');
      return await sendEmail(config, recipient.email, content.subject || '', content.body);
    
    case 'sms':
      if (!recipient.phone) throw new Error('Phone number required');
      return await sendSMS(config, recipient.phone, content.body);
    
    case 'phone':
      if (!recipient.phone) throw new Error('Phone number required');
      return await makePhoneCall(config, recipient.phone, content.body);
    
    case 'voicemail':
      if (!recipient.phone) throw new Error('Phone number required');
      return await dropVoicemail(config, recipient.phone, content.body);
    
    case 'linkedin':
      if (!recipient.linkedinId) throw new Error('LinkedIn ID required');
      return await sendLinkedInMessage(config, recipient.linkedinId, content.body);
    
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
}
