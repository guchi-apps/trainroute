-- CreateTable
CREATE TABLE `CommuteRoute` (
    `id` VARCHAR(191) NOT NULL,
    `userEmail` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `originStationCode` VARCHAR(20) NOT NULL,
    `originStationName` VARCHAR(100) NOT NULL,
    `destinationStationCode` VARCHAR(20) NOT NULL,
    `destinationStationName` VARCHAR(100) NOT NULL,
    `viaStationCode` VARCHAR(20) NULL,
    `viaStationName` VARCHAR(100) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommuteRoute_userEmail_sortOrder_idx`(`userEmail`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommuteRouteLine` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(50) NOT NULL,
    `lineCode` VARCHAR(20) NULL,
    `lineName` VARCHAR(100) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `CommuteRouteLine_routeId_sortOrder_idx`(`routeId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommuteRouteLine` ADD CONSTRAINT `CommuteRouteLine_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `CommuteRoute`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

