-- Add ngram FULLTEXT indexes for server-side substring search on folder and document names.
-- Requires MySQL 8+ with InnoDB (both already enforced by the project).
--
-- The ngram parser tokenises names into overlapping character n-grams (default token size: 2),
-- enabling indexed substring matching — e.g. "rep" matches "report.pdf".
-- Searches shorter than ngram_token_size (default 2) return no results; the application
-- layer normalises this by treating <2-char queries as "no search".
--
-- Index size trade-off: ngram indexes are larger than B-tree indexes because every
-- n-gram substring is stored as a separate token. This is the accepted cost for
-- indexed substring search without an external search engine.

ALTER TABLE `folders`
  ADD FULLTEXT INDEX `folders_name_ngram` (`name`) WITH PARSER ngram;

ALTER TABLE `documents`
  ADD FULLTEXT INDEX `documents_fileName_ngram` (`fileName`) WITH PARSER ngram;
