SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'v_key_results_with_trend' OR table_name = 'key_results'
ORDER BY table_name, ordinal_position;
