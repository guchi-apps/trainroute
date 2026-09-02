-- CreateTable
CREATE TABLE `TransitApiQuota` (
    `provider` VARCHAR(50) NOT NULL,
    `quotaLimit` INTEGER NULL,
    `remaining` INTEGER NOT NULL,
    `resetAt` DATETIME(3) NULL,
    `source` VARCHAR(20) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`provider`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
