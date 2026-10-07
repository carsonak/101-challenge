ALTER TABLE attempts ADD "streakBreaks" jsonb NOT NULL DEFAULT '[]';
DROP INDEX attempts_one_current;
CREATE UNIQUE INDEX attempts_one_current ON attempts("enrollmentId") WHERE status IN ('active','paused');
