-- Seed data for campaign_responses table (Unified Inbox testing)
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual auth.users ID
-- To get your user ID, run: SELECT id FROM auth.users WHERE email = 'your@email.com';

-- Sample LinkedIn responses
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'linkedin', 'Sarah Chen', 'https://linkedin.com/in/sarachen', 
   'Hi! Thanks for reaching out. I''d love to learn more about your solution. Do you have time for a quick call this week?', 
   'interested', 0.92, false, NOW() - INTERVAL '2 hours'),
  
  ('YOUR_USER_ID_HERE', 'linkedin', 'Michael Torres', 'https://linkedin.com/in/michaeltorres', 
   'Not interested at this time, but feel free to check back in Q2 next year.', 
   'not_interested', 0.88, false, NOW() - INTERVAL '5 hours'),
  
  ('YOUR_USER_ID_HERE', 'linkedin', 'Jennifer Park', 'https://linkedin.com/in/jenniferpark', 
   'Interesting! Can you send me more details about pricing and implementation timeline?', 
   'question', 0.85, false, NOW() - INTERVAL '1 day');

-- Sample Email responses
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'email', 'David Kumar', 'david.kumar@techcorp.com', 
   'Thanks for the email. We''re currently evaluating solutions in this space. Could we schedule a demo for next Tuesday?', 
   'meeting_request', 0.95, false, NOW() - INTERVAL '3 hours'),
  
  ('YOUR_USER_ID_HERE', 'email', 'Lisa Anderson', 'l.anderson@startup.io', 
   'I''m out of office until November 25th. Will respond when I return.', 
   'out_of_office', 0.99, true, NOW() - INTERVAL '1 day'),
  
  ('YOUR_USER_ID_HERE', 'email', 'Robert Zhang', 'r.zhang@enterprise.com', 
   'We don''t have budget for this right now. Our current solution is working fine.', 
   'objection', 0.87, false, NOW() - INTERVAL '6 hours');

-- Sample SMS responses  
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'sms', 'Maria Garcia', '+1-555-0123', 
   'Yes! This looks great. Can you send me a proposal?', 
   'interested', 0.91, false, NOW() - INTERVAL '30 minutes'),
  
  ('YOUR_USER_ID_HERE', 'sms', 'James Wilson', '+1-555-0456', 
   'Please remove me from your list.', 
   'not_interested', 0.94, true, NOW() - INTERVAL '2 days');

-- Sample Phone responses
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'phone', 'Amanda Foster', '+1-555-0789', 
   'Call was productive. Asked about ROI calculations and case studies. Follow up with materials by Friday.', 
   'interested', 0.89, false, NOW() - INTERVAL '4 hours'),
  
  ('YOUR_USER_ID_HERE', 'phone', 'Chris Martinez', '+1-555-0321', 
   'Left voicemail. Prospect mentioned they''re already working with a competitor but open to comparison.', 
   'question', 0.78, false, NOW() - INTERVAL '1 day');

-- Sample Social Media responses
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'social', 'Emily Watson', '@emilywatson', 
   'Saw your post about AI automation. Would love to chat about how this could help our marketing team!', 
   'interested', 0.86, false, NOW() - INTERVAL '8 hours'),
  
  ('YOUR_USER_ID_HERE', 'social', 'Tom Richards', '@tomrichards_official', 
   'Thanks for connecting! This is interesting but I need to discuss with my team first.', 
   'other', 0.65, false, NOW() - INTERVAL '12 hours');

-- Sample Voicemail responses
INSERT INTO campaign_responses (user_id, channel, sender_name, sender_identifier, message_content, intent_tag, confidence_score, is_read, responded_at)
VALUES
  ('YOUR_USER_ID_HERE', 'voicemail', 'Patricia Lee', '+1-555-0654', 
   'Hi, this is Patricia from Acme Corp. Got your voicemail about the sales automation platform. Sounds interesting - please call me back at 555-0654.', 
   'interested', 0.84, false, NOW() - INTERVAL '6 hours'),
  
  ('YOUR_USER_ID_HERE', 'voicemail', 'Kevin Brown', '+1-555-0987', 
   'This is Kevin. Not sure how you got my number, but we''re not looking for new vendors right now. Thanks.', 
   'not_interested', 0.91, true, NOW() - INTERVAL '3 days');

-- Verification query (run this after inserting to confirm data loaded)
-- SELECT channel, intent_tag, COUNT(*) 
-- FROM campaign_responses 
-- WHERE user_id = 'YOUR_USER_ID_HERE'
-- GROUP BY channel, intent_tag 
-- ORDER BY channel, intent_tag;
