-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'CHIEF_DOCTOR', 'ORTHOPEDIC_MANAGER', 'SURGEON', 'ORTHOPEDIST', 'CONSULTING_DOCTOR', 'DENTAL_TECHNICIAN', 'ASSISTANT', 'RADIOLOGY_OPERATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "PatientSource" AS ENUM ('LOCAL', 'STOMA1C', 'IMPORT');

-- CreateEnum
CREATE TYPE "JawScope" AS ENUM ('UPPER', 'LOWER', 'BOTH');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('CONSULTING_DOCTOR', 'ORTHOPEDIST', 'SURGEON', 'DENTAL_TECHNICIAN');

-- CreateEnum
CREATE TYPE "ProtocolVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OwnerRole" AS ENUM ('ORTHOPEDIST', 'SURGEON', 'CHIEF_DOCTOR', 'QUALITY_MANAGER');

-- CreateEnum
CREATE TYPE "StageInstanceStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'UPLOADING', 'PROCESSING', 'REVIEW_REQUIRED', 'RESHOOT_REQUIRED', 'READY_FOR_CONFIRMATION', 'CONFIRMED', 'CLOSED', 'REOPENED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT', 'RADIOLOGY_IMAGE', 'RADIOLOGY_STUDY', 'DICOM_SERIES', 'STRUCTURED_DATA', 'STRUCTURED_CONFIRMATION');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'AI_SUGGESTED', 'UNASSIGNED', 'DOCTOR_CONFIRMED', 'SURGEON_CONFIRMED', 'TECHNICALLY_REJECTED', 'REPLACED', 'ADDITIONAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DerivativeType" AS ENUM ('THUMBNAIL', 'PREVIEW', 'POSTER', 'WEB_VIDEO', 'AI_SANITIZED_COPY', 'PDF_PREVIEW', 'DICOM_PREVIEW');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('AI', 'DOCTOR', 'SURGEON');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'REPLACED');

-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('CREATED', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_FAILED');

-- CreateEnum
CREATE TYPE "RadiologyStudyType" AS ENUM ('OPTG', 'CBCT', 'CT', 'OTHER');

-- CreateEnum
CREATE TYPE "RadiologyStudyStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'REJECTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ImplantSide" AS ENUM ('LEFT', 'RIGHT', 'MIDLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImplantRecordStatus" AS ENUM ('DRAFT', 'DOCUMENTED', 'NEEDS_REVIEW', 'ACCEPTED_BY_SURGEON');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('CT_CROSS_SECTION', 'CT_AXIAL', 'CT_PANORAMIC_RECONSTRUCTION', 'CT_CORONAL', 'CT_SAGITTAL', 'OPTG_FRAGMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OptgStatus" AS ENUM ('NOT_UPLOADED', 'ACCEPTABLE', 'REPEAT_REQUIRED');

-- CreateEnum
CREATE TYPE "RegistrationConclusion" AS ENUM ('ACCEPTABLE_FOR_LAB', 'REPEAT_REQUIRED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STAGE_REPORT', 'CASE_REPORT', 'SURGICAL_RADIOLOGY_REPORT', 'FULL_PROTOCOL_REPORT');

-- CreateEnum
CREATE TYPE "ExternalSystem" AS ENUM ('STOMA1C');

-- CreateEnum
CREATE TYPE "ExternalEntityType" AS ENUM ('PATIENT', 'STAFF_MEMBER', 'BRANCH', 'APPOINTMENT', 'MEDICAL_RECORD', 'CLINICAL_CASE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('MANUAL', 'SYNCED', 'ERROR', 'CONFLICT');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('STOMA1C');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'CONFLICT');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "position" TEXT NOT NULL,
    "specialization" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "localPatientNumber" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "birthDate" DATE,
    "sex" "Sex" NOT NULL DEFAULT 'UNSPECIFIED',
    "phone" TEXT,
    "comment" TEXT,
    "branchId" TEXT,
    "source" "PatientSource" NOT NULL DEFAULT 'LOCAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolVersion" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ProtocolVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTemplate" (
    "id" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "ownerRole" "OwnerRole" NOT NULL,
    "dependsOnStageCode" TEXT,
    "startBlockedUntilDependencyClosed" BOOLEAN NOT NULL DEFAULT false,
    "closeBlockedUntilDependencyClosed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalCase" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalScenario" TEXT NOT NULL,
    "jawScope" "JawScope" NOT NULL,
    "treatmentStartDate" DATE NOT NULL,
    "branchId" TEXT,
    "protocolVersionId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseParticipant" (
    "id" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "participantRole" "ParticipantRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removalReason" TEXT,

    CONSTRAINT "CaseParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageInstance" (
    "id" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "status" "StageInstanceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "restHeightMm" DECIMAL(8,2),
    "workingHeightMm" DECIMAL(8,2),
    "heightDifferenceMm" DECIMAL(8,2),
    "optgStatus" "OptgStatus",
    "registrationConclusion" "RegistrationConclusion",
    "clinicalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "minWidth" INTEGER NOT NULL DEFAULT 0,
    "minHeight" INTEGER NOT NULL DEFAULT 0,
    "maxBlurScore" DOUBLE PRECISION,
    "minBrightness" DOUBLE PRECISION,
    "maxBrightness" DOUBLE PRECISION,
    "requireAudio" BOOLEAN,
    "minVideoDurationSec" DOUBLE PRECISION,
    "maxVideoDurationSec" DOUBLE PRECISION,
    "allowedMimeTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRequirement" (
    "id" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    "maxCount" INTEGER,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "jawScope" "JawScope",
    "viewType" TEXT,
    "patientState" TEXT,
    "instruction" TEXT,
    "referenceAssetId" TEXT,
    "qualityProfileId" TEXT,
    "specialRule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementInstance" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "mediaRequirementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "status" "UploadBatchStatus" NOT NULL DEFAULT 'CREATED',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadChunk" (
    "id" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UploadChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "uploadBatchId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storedObjectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "perceptualHash" TEXT,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "blurScore" DOUBLE PRECISION,
    "brightnessScore" DOUBLE PRECISION,
    "qualityPassed" BOOLEAN,
    "hasAudio" BOOLEAN,
    "durationSec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaDerivative" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "type" "DerivativeType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaDerivative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaMetadata" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "fps" DOUBLE PRECISION,
    "hasAudio" BOOLEAN,
    "codec" TEXT,
    "dicomModality" TEXT,
    "dicomStudyDate" TIMESTAMP(3),
    "dicomSeriesDescription" TEXT,
    "exifRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAssignment" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "requirementInstanceId" TEXT,
    "requirementCode" TEXT,
    "source" "AssignmentSource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SUGGESTED',
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyStudy" (
    "id" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "studyType" "RadiologyStudyType" NOT NULL,
    "studyDate" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "responsibleDoctorId" TEXT,
    "status" "RadiologyStudyStatus" NOT NULL DEFAULT 'UPLOADED',
    "mainMediaAssetId" TEXT,
    "dicomSeriesAssetId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplantPlacementMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "methodNumber" INTEGER NOT NULL,
    "submethodCode" TEXT,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT,
    "shortDescription" TEXT,
    "detailedDescription" TEXT,
    "anatomicalRegion" TEXT,
    "jawScope" "JawScope" NOT NULL DEFAULT 'BOTH',
    "requiresOptg" BOOLEAN NOT NULL DEFAULT false,
    "requiresCbct" BOOLEAN NOT NULL DEFAULT false,
    "requiresCtSlice" BOOLEAN NOT NULL DEFAULT true,
    "requiresCorticalTarget" BOOLEAN NOT NULL DEFAULT false,
    "requiresNerveRelation" BOOLEAN NOT NULL DEFAULT false,
    "requiresSinusRelation" BOOLEAN NOT NULL DEFAULT false,
    "requiresNasalFloorRelation" BOOLEAN NOT NULL DEFAULT false,
    "requiresPterygoidRelation" BOOLEAN NOT NULL DEFAULT false,
    "requiresZygomaticRelation" BOOLEAN NOT NULL DEFAULT false,
    "isGeneral" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "sourceDocumentName" TEXT NOT NULL DEFAULT 'Strategic Implant Methods',
    "sourcePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplantPlacementMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgicalImplantRecord" (
    "id" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "implantNumber" INTEGER NOT NULL,
    "implantLabel" TEXT NOT NULL,
    "jawScope" "JawScope" NOT NULL,
    "side" "ImplantSide" NOT NULL DEFAULT 'UNKNOWN',
    "toothPositionFdi" TEXT,
    "regionDescription" TEXT,
    "implantSystem" TEXT,
    "implantModel" TEXT,
    "implantDiameter" TEXT,
    "implantLength" TEXT,
    "plannedMethodCode" TEXT,
    "actualMethodCode" TEXT NOT NULL,
    "actualSubmethodCode" TEXT,
    "primaryCorticalTarget" TEXT,
    "secondaryCorticalTarget" TEXT,
    "implantHeadPositionComment" TEXT,
    "surgeonComment" TEXT,
    "status" "ImplantRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgicalImplantRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplantRadiologyAttachment" (
    "id" TEXT NOT NULL,
    "surgicalImplantRecordId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "attachmentType" "AttachmentType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "surgeonConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "showsImplantFullLength" BOOLEAN,
    "showsApicalThread" BOOLEAN,
    "showsCorticalEngagement" BOOLEAN,
    "showsNerveRelation" BOOLEAN,
    "showsSinusRelation" BOOLEAN,
    "showsNasalFloorRelation" BOOLEAN,
    "showsPterygoidRelation" BOOLEAN,
    "showsZygomaticRelation" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplantRadiologyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgeonRadiologyConfirmation" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "surgeonUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationText" TEXT NOT NULL,
    "allImplantsDocumented" BOOLEAN NOT NULL,
    "optgUploaded" BOOLEAN NOT NULL,
    "cbctUploaded" BOOLEAN NOT NULL,
    "allImplantsHaveCtSlices" BOOLEAN NOT NULL,
    "allImplantsHaveMethodSelected" BOOLEAN NOT NULL,
    "hasImplantsForReview" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "snapshotHash" TEXT NOT NULL,

    CONSTRAINT "SurgeonRadiologyConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorConfirmation" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "confirmationText" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageClosure" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closureSnapshotHash" TEXT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "StageClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyEvent" (
    "id" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "clinicalSituation" TEXT NOT NULL,
    "actionPerformed" TEXT NOT NULL,
    "missingMaterials" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "clinicalCaseId" TEXT,
    "stageInstanceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "stageInstanceId" TEXT,
    "reportType" "ReportType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "sha256" TEXT NOT NULL,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalEntityReference" (
    "id" TEXT NOT NULL,
    "system" "ExternalSystem" NOT NULL DEFAULT 'STOMA1C',
    "entityType" "ExternalEntityType" NOT NULL,
    "internalEntityType" TEXT NOT NULL,
    "internalEntityId" TEXT NOT NULL,
    "externalEntityId" TEXT NOT NULL,
    "externalDatabaseId" TEXT,
    "externalPresentation" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'MANUAL',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalEntityReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'STOMA1C',
    "direction" "IntegrationDirection" NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "externalEntityId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
    "requestPayloadRedacted" JSONB NOT NULL DEFAULT '{}',
    "responsePayloadRedacted" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_staffMemberId_key" ON "User"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_localPatientNumber_key" ON "Patient"("localPatientNumber");

-- CreateIndex
CREATE INDEX "Patient_lastName_firstName_birthDate_idx" ON "Patient"("lastName", "firstName", "birthDate");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_code_key" ON "Protocol"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_protocolId_version_key" ON "ProtocolVersion"("protocolId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "StageTemplate_protocolVersionId_code_key" ON "StageTemplate"("protocolVersionId", "code");

-- CreateIndex
CREATE INDEX "ClinicalCase_patientId_idx" ON "ClinicalCase"("patientId");

-- CreateIndex
CREATE INDEX "ClinicalCase_status_idx" ON "ClinicalCase"("status");

-- CreateIndex
CREATE INDEX "CaseParticipant_clinicalCaseId_participantRole_idx" ON "CaseParticipant"("clinicalCaseId", "participantRole");

-- CreateIndex
CREATE INDEX "StageInstance_clinicalCaseId_idx" ON "StageInstance"("clinicalCaseId");

-- CreateIndex
CREATE INDEX "StageInstance_status_idx" ON "StageInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaRequirement_stageTemplateId_code_key" ON "MediaRequirement"("stageTemplateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementInstance_stageInstanceId_mediaRequirementId_key" ON "RequirementInstance"("stageInstanceId", "mediaRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadChunk_uploadBatchId_chunkIndex_key" ON "UploadChunk"("uploadBatchId", "chunkIndex");

-- CreateIndex
CREATE INDEX "MediaAsset_stageInstanceId_idx" ON "MediaAsset"("stageInstanceId");

-- CreateIndex
CREATE INDEX "MediaAsset_sha256_idx" ON "MediaAsset"("sha256");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaMetadata_mediaAssetId_key" ON "MediaMetadata"("mediaAssetId");

-- CreateIndex
CREATE INDEX "MediaAssignment_mediaAssetId_idx" ON "MediaAssignment"("mediaAssetId");

-- CreateIndex
CREATE INDEX "MediaAssignment_requirementInstanceId_idx" ON "MediaAssignment"("requirementInstanceId");

-- CreateIndex
CREATE INDEX "RadiologyStudy_stageInstanceId_idx" ON "RadiologyStudy"("stageInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ImplantPlacementMethod_code_key" ON "ImplantPlacementMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SurgicalImplantRecord_stageInstanceId_implantNumber_key" ON "SurgicalImplantRecord"("stageInstanceId", "implantNumber");

-- CreateIndex
CREATE INDEX "SurgicalImplantRecord_stageInstanceId_idx" ON "SurgicalImplantRecord"("stageInstanceId");

-- CreateIndex
CREATE INDEX "ImplantRadiologyAttachment_surgicalImplantRecordId_idx" ON "ImplantRadiologyAttachment"("surgicalImplantRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeonRadiologyConfirmation_stageInstanceId_key" ON "SurgeonRadiologyConfirmation"("stageInstanceId");

-- CreateIndex
CREATE INDEX "AuditEvent_clinicalCaseId_idx" ON "AuditEvent"("clinicalCaseId");

-- CreateIndex
CREATE INDEX "AuditEvent_stageInstanceId_idx" ON "AuditEvent"("stageInstanceId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEntityReference_system_entityType_externalDatabaseId_externalEntityId_key" ON "ExternalEntityReference"("system", "entityType", "externalDatabaseId", "externalEntityId");

-- CreateIndex
CREATE INDEX "ExternalEntityReference_internalEntityType_internalEntityId_idx" ON "ExternalEntityReference"("internalEntityType", "internalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_idempotencyKey_key" ON "IntegrationEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationEvent_status_nextRetryAt_idx" ON "IntegrationEvent"("status", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTemplate" ADD CONSTRAINT "StageTemplate_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalCase" ADD CONSTRAINT "ClinicalCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalCase" ADD CONSTRAINT "ClinicalCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalCase" ADD CONSTRAINT "ClinicalCase_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParticipant" ADD CONSTRAINT "CaseParticipant_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParticipant" ADD CONSTRAINT "CaseParticipant_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageInstance" ADD CONSTRAINT "StageInstance_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageInstance" ADD CONSTRAINT "StageInstance_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "StageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageInstance" ADD CONSTRAINT "StageInstance_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRequirement" ADD CONSTRAINT "MediaRequirement_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRequirement" ADD CONSTRAINT "MediaRequirement_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "StageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRequirement" ADD CONSTRAINT "MediaRequirement_qualityProfileId_fkey" FOREIGN KEY ("qualityProfileId") REFERENCES "QualityProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementInstance" ADD CONSTRAINT "RequirementInstance_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementInstance" ADD CONSTRAINT "RequirementInstance_mediaRequirementId_fkey" FOREIGN KEY ("mediaRequirementId") REFERENCES "MediaRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadChunk" ADD CONSTRAINT "UploadChunk_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaDerivative" ADD CONSTRAINT "MediaDerivative_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaMetadata" ADD CONSTRAINT "MediaMetadata_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssignment" ADD CONSTRAINT "MediaAssignment_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssignment" ADD CONSTRAINT "MediaAssignment_requirementInstanceId_fkey" FOREIGN KEY ("requirementInstanceId") REFERENCES "RequirementInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudy" ADD CONSTRAINT "RadiologyStudy_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudy" ADD CONSTRAINT "RadiologyStudy_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalImplantRecord" ADD CONSTRAINT "SurgicalImplantRecord_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalImplantRecord" ADD CONSTRAINT "SurgicalImplantRecord_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplantRadiologyAttachment" ADD CONSTRAINT "ImplantRadiologyAttachment_surgicalImplantRecordId_fkey" FOREIGN KEY ("surgicalImplantRecordId") REFERENCES "SurgicalImplantRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplantRadiologyAttachment" ADD CONSTRAINT "ImplantRadiologyAttachment_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeonRadiologyConfirmation" ADD CONSTRAINT "SurgeonRadiologyConfirmation_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorConfirmation" ADD CONSTRAINT "DoctorConfirmation_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageClosure" ADD CONSTRAINT "StageClosure_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "StageInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
