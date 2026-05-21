-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATION_MANAGER', 'SUPERVISOR', 'ACCOUNTANT', 'HR', 'VIEWER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'ACCIDENT', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PAID', 'LOCKED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "cityId" TEXT,
    "driverId" TEXT,
    "supervisorId" TEXT,
    "cityScope" TEXT,
    "projectScope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appName" TEXT,
    "cityId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "cityId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "driverCode" TEXT,
    "name" TEXT NOT NULL,
    "actualName" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "nationalId" TEXT,
    "nationality" TEXT,
    "cityId" TEXT,
    "projectId" TEXT,
    "supervisorId" TEXT,
    "vehicleId" TEXT,
    "accountId" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractType" TEXT,
    "sponsorshipType" TEXT,
    "accommodationType" TEXT,
    "housingStatus" TEXT,
    "joinDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleCode" TEXT,
    "plateAr" TEXT,
    "plateArabic" TEXT,
    "plateEn" TEXT NOT NULL,
    "plateEnglish" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "rentalCompany" TEXT,
    "monthlyRent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentDriverId" TEXT,
    "cityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationProject" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "projectId" TEXT,
    "cityId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyTarget" INTEGER,
    "dailyTarget" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationInvoiceSetting" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationProjectId" TEXT,
    "name" TEXT NOT NULL,
    "invoiceType" TEXT,
    "requiredColumns" JSONB,
    "optionalColumns" JSONB,
    "columnMapping" JSONB,
    "calculationRules" JSONB,
    "deductionRules" JSONB,
    "bonusRules" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInvoiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRankSetting" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationProjectId" TEXT,
    "name" TEXT NOT NULL,
    "rankType" TEXT,
    "minimumOrders" INTEGER,
    "onTimeRule" JSONB,
    "cancellationRule" JSONB,
    "rejectionRule" JSONB,
    "workingHoursRule" JSONB,
    "bonusRule" JSONB,
    "deductionRule" JSONB,
    "levelOutput" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRankSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationPayrollSetting" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationProjectId" TEXT,
    "cityId" TEXT,
    "name" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2),
    "targetOrders" INTEGER,
    "extraOrderPrice" DECIMAL(12,2),
    "levelRules" JSONB,
    "bonusRules" JSONB,
    "deductionRules" JSONB,
    "carRentRule" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationPayrollSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationImportTemplate" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "applicationProjectId" TEXT,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "requiredColumns" JSONB,
    "optionalColumns" JSONB,
    "columnMapping" JSONB,
    "sampleFileUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationImportBatch" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "applicationProjectId" TEXT,
    "templateId" TEXT,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "missingDrivers" INTEGER NOT NULL DEFAULT 0,
    "unlinkedAccounts" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "driverId" TEXT,
    "applicationAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAccount" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "appUserId" TEXT,
    "appUsername" TEXT,
    "applicationId" TEXT,
    "applicationProjectId" TEXT,
    "projectId" TEXT,
    "cityId" TEXT,
    "driverId" TEXT,
    "isEmpty" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "month" TEXT NOT NULL,
    "driverId" TEXT,
    "cityId" TEXT,
    "projectId" TEXT,
    "appName" TEXT,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "workingHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "onTimeRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cancellationRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rejectionRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "payrollItemId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "deductionMonth" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "payrollItemId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "month" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Violation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "payrollItemId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "projectId" TEXT,
    "month" TEXT NOT NULL,
    "basicSalary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "applicationId" TEXT,
    "applicationProjectId" TEXT,
    "cityId" TEXT,
    "payrollSettingId" TEXT,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDrivers" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "applicationAccountId" TEXT,
    "vehicleId" TEXT,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "extraOrders" INTEGER NOT NULL DEFAULT 0,
    "workingHours" DECIMAL(8,2),
    "onTimeRate" DECIMAL(8,2),
    "cancellationRate" DECIMAL(8,2),
    "rejectionRate" DECIMAL(8,2),
    "level" TEXT,
    "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extraOrdersBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "performanceBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rentalDays" INTEGER NOT NULL DEFAULT 0,
    "carRent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advancesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "violationsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fuelTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "appDeductionsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "damagesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accidentDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rentalDays" INTEGER,
    "calculatedRent" DECIMAL(12,2),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelRecord" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "liters" DECIMAL(10,2),
    "fuelDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "payrollItemId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cityId" TEXT,
    "supervisorId" TEXT,
    "driverId" TEXT,
    "priority" "Severity" NOT NULL DEFAULT 'INFO',
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "driverId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "phone" TEXT,
    "cityId" TEXT,
    "projectId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "convertedDriverId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverContract" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "sponsor" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverHousing" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "housingType" TEXT NOT NULL,
    "accommodationType" TEXT,
    "location" TEXT,
    "roomNumber" TEXT,
    "monthlyCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverHousing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverWarning" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "workingHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "driverId" TEXT,
    "name" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "cityId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedReport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "appName" TEXT,
    "cityId" TEXT,
    "month" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "rowsCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppAccountMovement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "appName" TEXT,
    "fromDriverId" TEXT,
    "toDriverId" TEXT,
    "movementType" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppAccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityTarget" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "projectId" TEXT,
    "appName" TEXT,
    "month" TEXT NOT NULL,
    "monthlyTarget" INTEGER NOT NULL DEFAULT 0,
    "requiredValidRiders" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "appName" TEXT,
    "month" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "rowsFound" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "user" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMovement" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fromDriverId" TEXT,
    "toDriverId" TEXT,
    "cityId" TEXT,
    "movementType" TEXT NOT NULL,
    "handoverDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCleaning" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "cleanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCleaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "type" TEXT NOT NULL,
    "vendor" TEXT,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAuthorization" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "authNumber" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCost" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rentCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maintenanceCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cleaningCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "accidentCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "damageCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAccident" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "cityId" TEXT,
    "type" TEXT,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "liabilityPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAccident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDamage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "type" TEXT NOT NULL,
    "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "finalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "entryType" TEXT NOT NULL,
    "applicationId" TEXT,
    "applicationProjectId" TEXT,
    "cityId" TEXT,
    "driverId" TEXT,
    "payrollRunId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "client" TEXT,
    "projectId" TEXT,
    "month" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "method" TEXT,
    "referenceNo" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "month" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revenue" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "month" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAccount" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashboxEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "responsible" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashboxEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatRecord" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "salesVat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "purchaseVat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netVat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitLossRecord" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "revenues" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payroll" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vehicleCosts" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitLossRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAuditRecord" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "result" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "columns" JSONB,
    "filters" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelMapping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiIntegration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCleaningIssue" (
    "id" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'WARNING',
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCleaningIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_internalCode_key" ON "Driver"("internalCode");

-- CreateIndex
CREATE INDEX "Driver_driverCode_idx" ON "Driver"("driverCode");

-- CreateIndex
CREATE INDEX "Driver_nationalId_idx" ON "Driver"("nationalId");

-- CreateIndex
CREATE INDEX "Driver_cityId_projectId_supervisorId_idx" ON "Driver"("cityId", "projectId", "supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateEn_key" ON "Vehicle"("plateEn");

-- CreateIndex
CREATE INDEX "Vehicle_plateAr_idx" ON "Vehicle"("plateAr");

-- CreateIndex
CREATE INDEX "Vehicle_plateArabic_idx" ON "Vehicle"("plateArabic");

-- CreateIndex
CREATE INDEX "Vehicle_plateEnglish_idx" ON "Vehicle"("plateEnglish");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleCode_idx" ON "Vehicle"("vehicleCode");

-- CreateIndex
CREATE INDEX "Vehicle_currentDriverId_idx" ON "Vehicle"("currentDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_code_key" ON "Application"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationProject_code_key" ON "ApplicationProject"("code");

-- CreateIndex
CREATE INDEX "ApplicationProject_applicationId_idx" ON "ApplicationProject"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationProject_projectId_idx" ON "ApplicationProject"("projectId");

-- CreateIndex
CREATE INDEX "ApplicationProject_cityId_idx" ON "ApplicationProject"("cityId");

-- CreateIndex
CREATE INDEX "ApplicationInvoiceSetting_applicationId_idx" ON "ApplicationInvoiceSetting"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationInvoiceSetting_applicationProjectId_idx" ON "ApplicationInvoiceSetting"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationRankSetting_applicationId_idx" ON "ApplicationRankSetting"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationRankSetting_applicationProjectId_idx" ON "ApplicationRankSetting"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationPayrollSetting_applicationId_idx" ON "ApplicationPayrollSetting"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationPayrollSetting_applicationProjectId_idx" ON "ApplicationPayrollSetting"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationPayrollSetting_cityId_idx" ON "ApplicationPayrollSetting"("cityId");

-- CreateIndex
CREATE INDEX "ApplicationImportTemplate_applicationId_idx" ON "ApplicationImportTemplate"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationImportTemplate_applicationProjectId_idx" ON "ApplicationImportTemplate"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_applicationId_idx" ON "ApplicationImportBatch"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_applicationProjectId_idx" ON "ApplicationImportBatch"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_templateId_idx" ON "ApplicationImportBatch"("templateId");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_createdById_idx" ON "ApplicationImportBatch"("createdById");

-- CreateIndex
CREATE INDEX "ApplicationImportBatch_status_createdAt_idx" ON "ApplicationImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationImportRow_driverId_idx" ON "ApplicationImportRow"("driverId");

-- CreateIndex
CREATE INDEX "ApplicationImportRow_applicationAccountId_idx" ON "ApplicationImportRow"("applicationAccountId");

-- CreateIndex
CREATE INDEX "ApplicationImportRow_status_idx" ON "ApplicationImportRow"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationImportRow_batchId_rowNumber_key" ON "ApplicationImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAccount_username_key" ON "ApplicationAccount"("username");

-- CreateIndex
CREATE INDEX "ApplicationAccount_applicationId_idx" ON "ApplicationAccount"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationAccount_applicationProjectId_idx" ON "ApplicationAccount"("applicationProjectId");

-- CreateIndex
CREATE INDEX "ApplicationAccount_projectId_idx" ON "ApplicationAccount"("projectId");

-- CreateIndex
CREATE INDEX "ApplicationAccount_cityId_idx" ON "ApplicationAccount"("cityId");

-- CreateIndex
CREATE INDEX "ApplicationAccount_driverId_idx" ON "ApplicationAccount"("driverId");

-- CreateIndex
CREATE INDEX "ApplicationAccount_appUserId_idx" ON "ApplicationAccount"("appUserId");

-- CreateIndex
CREATE INDEX "DailyReport_month_cityId_projectId_idx" ON "DailyReport"("month", "cityId", "projectId");

-- CreateIndex
CREATE INDEX "Advance_driverId_idx" ON "Advance"("driverId");

-- CreateIndex
CREATE INDEX "Advance_payrollItemId_idx" ON "Advance"("payrollItemId");

-- CreateIndex
CREATE INDEX "Advance_deductionMonth_status_idx" ON "Advance"("deductionMonth", "status");

-- CreateIndex
CREATE INDEX "Deduction_driverId_idx" ON "Deduction"("driverId");

-- CreateIndex
CREATE INDEX "Deduction_payrollItemId_idx" ON "Deduction"("payrollItemId");

-- CreateIndex
CREATE INDEX "Deduction_month_status_idx" ON "Deduction"("month", "status");

-- CreateIndex
CREATE INDEX "Violation_driverId_idx" ON "Violation"("driverId");

-- CreateIndex
CREATE INDEX "Violation_vehicleId_idx" ON "Violation"("vehicleId");

-- CreateIndex
CREATE INDEX "Violation_payrollItemId_idx" ON "Violation"("payrollItemId");

-- CreateIndex
CREATE INDEX "Violation_status_occurredAt_idx" ON "Violation"("status", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_driverId_month_key" ON "Payroll"("driverId", "month");

-- CreateIndex
CREATE INDEX "PayrollRun_year_month_idx" ON "PayrollRun"("year", "month");

-- CreateIndex
CREATE INDEX "PayrollRun_applicationId_idx" ON "PayrollRun"("applicationId");

-- CreateIndex
CREATE INDEX "PayrollRun_applicationProjectId_idx" ON "PayrollRun"("applicationProjectId");

-- CreateIndex
CREATE INDEX "PayrollRun_cityId_idx" ON "PayrollRun"("cityId");

-- CreateIndex
CREATE INDEX "PayrollRun_payrollSettingId_idx" ON "PayrollRun"("payrollSettingId");

-- CreateIndex
CREATE INDEX "PayrollRun_approvedById_idx" ON "PayrollRun"("approvedById");

-- CreateIndex
CREATE INDEX "PayrollRun_year_month_applicationId_applicationProjectId_ci_idx" ON "PayrollRun"("year", "month", "applicationId", "applicationProjectId", "cityId");

-- CreateIndex
CREATE INDEX "PayrollItem_payrollRunId_idx" ON "PayrollItem"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollItem_driverId_idx" ON "PayrollItem"("driverId");

-- CreateIndex
CREATE INDEX "PayrollItem_applicationAccountId_idx" ON "PayrollItem"("applicationAccountId");

-- CreateIndex
CREATE INDEX "PayrollItem_vehicleId_idx" ON "PayrollItem"("vehicleId");

-- CreateIndex
CREATE INDEX "PayrollItem_status_idx" ON "PayrollItem"("status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollItemId_idx" ON "PayrollAdjustment"("payrollItemId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_createdById_idx" ON "PayrollAdjustment"("createdById");

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicleId_idx" ON "VehicleAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_driverId_idx" ON "VehicleAssignment"("driverId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_status_idx" ON "VehicleAssignment"("status");

-- CreateIndex
CREATE INDEX "FuelRecord_driverId_idx" ON "FuelRecord"("driverId");

-- CreateIndex
CREATE INDEX "FuelRecord_vehicleId_idx" ON "FuelRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelRecord_payrollItemId_idx" ON "FuelRecord"("payrollItemId");

-- CreateIndex
CREATE INDEX "FuelRecord_fuelDate_status_idx" ON "FuelRecord"("fuelDate", "status");

-- CreateIndex
CREATE INDEX "DriverDocument_driverId_status_idx" ON "DriverDocument"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverDocument_documentType_idx" ON "DriverDocument"("documentType");

-- CreateIndex
CREATE INDEX "DriverDocument_expiryDate_idx" ON "DriverDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "DriverContract_driverId_status_idx" ON "DriverContract"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverHousing_driverId_status_idx" ON "DriverHousing"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverWarning_driverId_status_idx" ON "DriverWarning"("driverId", "status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_driverId_workDate_idx" ON "AttendanceRecord"("driverId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "CityTarget_cityId_appName_month_key" ON "CityTarget"("cityId", "appName", "month");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "VehicleMovement_vehicleId_status_idx" ON "VehicleMovement"("vehicleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCost_vehicleId_month_key" ON "VehicleCost"("vehicleId", "month");

-- CreateIndex
CREATE INDEX "FinanceEntry_sourceType_sourceId_idx" ON "FinanceEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "FinanceEntry_entryType_direction_idx" ON "FinanceEntry"("entryType", "direction");

-- CreateIndex
CREATE INDEX "FinanceEntry_applicationId_idx" ON "FinanceEntry"("applicationId");

-- CreateIndex
CREATE INDEX "FinanceEntry_applicationProjectId_idx" ON "FinanceEntry"("applicationProjectId");

-- CreateIndex
CREATE INDEX "FinanceEntry_cityId_idx" ON "FinanceEntry"("cityId");

-- CreateIndex
CREATE INDEX "FinanceEntry_driverId_idx" ON "FinanceEntry"("driverId");

-- CreateIndex
CREATE INDEX "FinanceEntry_payrollRunId_idx" ON "FinanceEntry"("payrollRunId");

-- CreateIndex
CREATE INDEX "FinanceEntry_entryDate_idx" ON "FinanceEntry"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitLossRecord_month_key" ON "ProfitLossRecord"("month");
