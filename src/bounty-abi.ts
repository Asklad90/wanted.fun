/**
 * WantedEscrow ABI — auto-maintained, matches contracts/WantedEscrow.sol
 */
export const BOUNTY_BOARD_ABI = [
  // ─── Constructor ──────────────────────────────────────────────────────────
  {
    type: 'constructor',
    inputs: [
      { name: 'usdc_', type: 'address' },
      { name: 'reviewWindow_', type: 'uint32' },
    ],
    stateMutability: 'nonpayable',
  },

  // ─── Immutables ───────────────────────────────────────────────────────────
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'reviewWindow', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },

  // ─── Write functions ──────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createBounty',
    inputs: [
      { name: 'title', type: 'bytes' },
      { name: 'description', type: 'bytes' },
      { name: 'rewardPerWinner', type: 'uint256' },
      { name: 'maxWinners', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submit',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'content', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveWinner',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'submitter', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reclaimUnused',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ─── View functions ───────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getBounty',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'poster', type: 'address' },
          { name: 'title', type: 'bytes' },
          { name: 'description', type: 'bytes' },
          { name: 'rewardPerWinner', type: 'uint256' },
          { name: 'maxWinners', type: 'uint256' },
          { name: 'winnersApproved', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'escrowRemaining', type: 'uint256' },
          { name: 'reclaimedUnused', type: 'bool' },
          { name: 'cancelled', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBountyCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalBounties',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalEscrowLocked',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalWinnersPaid',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubmissions',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'bountyId', type: 'uint256' },
          { name: 'content', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isWinner',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'payoutStatus',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    // returns uint8: 0=None, 1=Pending, 2=Paid
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasSubmitted',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBountiesByPoster',
    inputs: [{ name: 'poster', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBountiesBySubmitter',
    inputs: [{ name: 'submitter', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'BountyCreated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'poster', type: 'address', indexed: true },
      { name: 'title', type: 'bytes', indexed: false },
      { name: 'description', type: 'bytes', indexed: false },
      { name: 'rewardPerWinner', type: 'uint256', indexed: false },
      { name: 'maxWinners', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint64', indexed: false },
      { name: 'total', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WorkSubmitted',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submissionId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'content', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WinnerPaid',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutPending',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowReclaimed',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'poster', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BountyCancelled',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true },
      { name: 'poster', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },

  // ─── Profile views ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getPostedBounties',
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubmittedBounties',
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEarnings',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [
      { name: 'paid', type: 'uint256' },
      { name: 'pending', type: 'uint256' },
      { name: 'wins', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMyStatus',
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'addr', type: 'address' },
    ],
    outputs: [{ type: 'uint8' }], // MyStatus enum
    stateMutability: 'view',
  },
  // --- v3 additions ---
  { type: 'function', name: 'CANCEL_WINDOW', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'createdAt', inputs: [{ name: 'bountyId', type: 'uint256' }], outputs: [{ type: 'uint64' }], stateMutability: 'view' },

  // --- Custom errors (lets the app show friendly revert messages) ---
  { type: 'error', name: 'AlreadyReclaimed', inputs: [] },
  { type: 'error', name: 'AlreadySubmitted', inputs: [] },
  { type: 'error', name: 'AlreadyWinner', inputs: [] },
  { type: 'error', name: 'ApprovalWindowClosed', inputs: [] },
  { type: 'error', name: 'BountyAlreadyCancelled', inputs: [] },
  { type: 'error', name: 'BountyFull', inputs: [] },
  { type: 'error', name: 'BountyNotFound', inputs: [] },
  { type: 'error', name: 'BountyWasCancelled', inputs: [] },
  { type: 'error', name: 'CancelWindowClosed', inputs: [] },
  { type: 'error', name: 'DeadlinePassedForSubmit', inputs: [] },
  { type: 'error', name: 'DepositMismatch', inputs: [] },
  { type: 'error', name: 'HasSubmissions', inputs: [] },
  { type: 'error', name: 'InvalidContent', inputs: [] },
  { type: 'error', name: 'InvalidDeadline', inputs: [] },
  { type: 'error', name: 'InvalidDescription', inputs: [] },
  { type: 'error', name: 'InvalidMaxWinners', inputs: [] },
  { type: 'error', name: 'InvalidReward', inputs: [] },
  { type: 'error', name: 'InvalidTitle', inputs: [] },
  { type: 'error', name: 'InvalidWinner', inputs: [] },
  { type: 'error', name: 'NotPendingPayout', inputs: [] },
  { type: 'error', name: 'NotPoster', inputs: [] },
  { type: 'error', name: 'NothingToReclaim', inputs: [] },
  { type: 'error', name: 'PosterCannotSubmit', inputs: [] },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  { type: 'error', name: 'ReviewWindowActive', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'SafeERC20FailedOperation', inputs: [{ name: 'token', type: 'address' }] },
] as const
