-- AddUniqueConstraint
-- Enforce unique file name per user per folder.
-- Note: MySQL treats NULL folderId as distinct, so root-level uniqueness
-- is enforced at the application layer.
ALTER TABLE `documents` ADD UNIQUE INDEX `documents_userId_folderId_fileName_key`(`userId`, `folderId`, `fileName`);
