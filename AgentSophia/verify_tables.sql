-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflows', 'workflow_nodes', 'workflow_edges');

-- Check table permissions
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('workflows', 'workflow_nodes', 'workflow_edges');
