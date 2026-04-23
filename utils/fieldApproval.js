const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const APPROVED_OR_LEGACY_CLAUSE = {
  $or: [
    { approvalStatus: APPROVAL_STATUS.APPROVED },
    { approvalStatus: { $exists: false } },
  ],
};

function getEffectiveApprovalStatus(field) {
  return field?.approvalStatus || APPROVAL_STATUS.APPROVED;
}

function isApprovedField(field) {
  return getEffectiveApprovalStatus(field) === APPROVAL_STATUS.APPROVED;
}

function buildApprovedFieldFilter(baseFilter = {}) {
  return {
    $and: [
      baseFilter,
      APPROVED_OR_LEGACY_CLAUSE,
    ],
  };
}

module.exports = {
  APPROVAL_STATUS,
  APPROVED_OR_LEGACY_CLAUSE,
  getEffectiveApprovalStatus,
  isApprovedField,
  buildApprovedFieldFilter,
};
