const https = require('https');
const {
  OrgIdResolver,
  httpFetchMethod,
  twitterFetchMethod
} = require('@windingtree/org.id-resolver');
const { JWK, JWT } = require('jose');
const ethers = require('ethers');
const axios = require('axios');
// const dns = require('dns');
const log = require('log4js').getLogger('smart_contracts_connector:utils');
log.level = 'debug';

const DIR_INDEX_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "segment",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "SegmentAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "segment",
        "type": "address"
      }
    ],
    "name": "SegmentRemoved",
    "type": "event"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "isOwner",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "segments",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "segmentsIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address payable",
        "name": "__owner",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "segment",
        "type": "address"
      }
    ],
    "name": "addSegment",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "segment",
        "type": "address"
      }
    ],
    "name": "removeSegment",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getSegments",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "segmentsList",
        "type": "address[]"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];
const ARB_DIR_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "_contributor",
        "type": "address"
      }
    ],
    "name": "ChallengeContributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract IArbitrator",
        "name": "_arbitrator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "_disputeID",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_metaEvidenceID",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_evidenceGroupID",
        "type": "uint256"
      }
    ],
    "name": "Dispute",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract IArbitrator",
        "name": "_arbitrator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "_evidenceGroupID",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "_party",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "_evidence",
        "type": "string"
      }
    ],
    "name": "Evidence",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "_metaEvidenceID",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "_evidence",
        "type": "string"
      }
    ],
    "name": "MetaEvidence",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      }
    ],
    "name": "OrganizationAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "_challenger",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      }
    ],
    "name": "OrganizationChallenged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "OrganizationRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "OrganizationRequestRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "OrganizationSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "contract IArbitrator",
        "name": "_arbitrator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "_disputeID",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "_ruling",
        "type": "uint256"
      }
    ],
    "name": "Ruling",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "_previousSegment",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "_newSegment",
        "type": "string"
      }
    ],
    "name": "SegmentChanged",
    "type": "event"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "MULTIPLIER_DIVISOR",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "RULING_OPTIONS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "arbitrator",
    "outputs": [
      {
        "internalType": "contract IArbitrator",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "arbitratorDisputeIDToOrg",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "arbitratorExtraData",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "challengeBaseDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "executionTimeout",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "governor",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "lif",
    "outputs": [
      {
        "internalType": "contract ERC20",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "loserStakeMultiplier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "metaEvidenceUpdates",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "orgId",
    "outputs": [
      {
        "internalType": "contract OrgIdInterface",
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "organizationData",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "ID",
        "type": "bytes32"
      },
      {
        "internalType": "enum ArbitrableDirectory.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "requester",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "lastStatusChange",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "lifStake",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "withdrawalRequestTime",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "organizationsIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "registeredOrganizations",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "requestedIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "requestedOrganizations",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "requesterDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "responseTimeout",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "sharedStakeMultiplier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "winnerStakeMultiplier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "withdrawTimeout",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "_governor",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "_segment",
        "type": "string"
      },
      {
        "internalType": "contract OrgIdInterface",
        "name": "_orgId",
        "type": "address"
      },
      {
        "internalType": "contract ERC20",
        "name": "_lif",
        "type": "address"
      },
      {
        "internalType": "contract IArbitrator",
        "name": "_arbitrator",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "_arbitratorExtraData",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "_metaEvidence",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_requesterDeposit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_challengeBaseDeposit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_executionTimeout",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_responseTimeout",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_withdrawTimeout",
        "type": "uint256"
      },
      {
        "internalType": "uint256[3]",
        "name": "_stakeMultipliers",
        "type": "uint256[3]"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "string",
        "name": "_segment",
        "type": "string"
      }
    ],
    "name": "setSegment",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_requesterDeposit",
        "type": "uint256"
      }
    ],
    "name": "changeRequesterDeposit",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_challengeBaseDeposit",
        "type": "uint256"
      }
    ],
    "name": "changeChallengeBaseDeposit",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_executionTimeout",
        "type": "uint256"
      }
    ],
    "name": "changeExecutionTimeout",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_responseTimeout",
        "type": "uint256"
      }
    ],
    "name": "changeResponseTimeout",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_withdrawTimeout",
        "type": "uint256"
      }
    ],
    "name": "changeWithdrawTimeout",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_sharedStakeMultiplier",
        "type": "uint256"
      }
    ],
    "name": "changeSharedStakeMultiplier",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_winnerStakeMultiplier",
        "type": "uint256"
      }
    ],
    "name": "changeWinnerStakeMultiplier",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_loserStakeMultiplier",
        "type": "uint256"
      }
    ],
    "name": "changeLoserStakeMultiplier",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "contract IArbitrator",
        "name": "_arbitrator",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "_arbitratorExtraData",
        "type": "bytes"
      }
    ],
    "name": "changeArbitrator",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "string",
        "name": "_metaEvidence",
        "type": "string"
      }
    ],
    "name": "changeMetaEvidence",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "requestToAdd",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "_evidence",
        "type": "string"
      }
    ],
    "name": "challengeOrganization",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "_evidence",
        "type": "string"
      }
    ],
    "name": "acceptChallenge",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "executeTimeout",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "enum ArbitrableDirectory.Party",
        "name": "_side",
        "type": "uint8"
      }
    ],
    "name": "fundAppeal",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_beneficiary",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_round",
        "type": "uint256"
      }
    ],
    "name": "withdrawFeesAndRewards",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_beneficiary",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      }
    ],
    "name": "withdrawFeesAndRewardsTotal",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "makeWithdrawalRequest",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "withdrawTokens",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_disputeID",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_ruling",
        "type": "uint256"
      }
    ],
    "name": "rule",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "_evidence",
        "type": "string"
      }
    ],
    "name": "submitEvidence",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getSegment",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_cursor",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_count",
        "type": "uint256"
      }
    ],
    "name": "getOrganizations",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "organizationsList",
        "type": "bytes32[]"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_cursor",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_count",
        "type": "uint256"
      }
    ],
    "name": "getOrganizationsCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_cursor",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_count",
        "type": "uint256"
      }
    ],
    "name": "getRequestedOrganizations",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "organizationsList",
        "type": "bytes32[]"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_cursor",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_count",
        "type": "uint256"
      }
    ],
    "name": "getRequestedOrganizationsCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_round",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_contributor",
        "type": "address"
      }
    ],
    "name": "getContributions",
    "outputs": [
      {
        "internalType": "uint256[3]",
        "name": "contributions",
        "type": "uint256[3]"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "getNumberOfChallenges",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "numberOfChallenges",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      }
    ],
    "name": "getNumberOfDisputes",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "numberOfDisputes",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      }
    ],
    "name": "getChallengeInfo",
    "outputs": [
      {
        "internalType": "bool",
        "name": "disputed",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "disputeID",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "resolved",
        "type": "bool"
      },
      {
        "internalType": "address payable",
        "name": "challenger",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "numberOfRounds",
        "type": "uint256"
      },
      {
        "internalType": "enum ArbitrableDirectory.Party",
        "name": "ruling",
        "type": "uint8"
      },
      {
        "internalType": "contract IArbitrator",
        "name": "arbitrator",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "arbitratorExtraData",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "metaEvidenceID",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_round",
        "type": "uint256"
      }
    ],
    "name": "getRoundInfo",
    "outputs": [
      {
        "internalType": "bool",
        "name": "appealed",
        "type": "bool"
      },
      {
        "internalType": "uint256[3]",
        "name": "paidFees",
        "type": "uint256[3]"
      },
      {
        "internalType": "bool[3]",
        "name": "hasPaid",
        "type": "bool[3]"
      },
      {
        "internalType": "uint256",
        "name": "feeRewards",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_beneficiary",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_round",
        "type": "uint256"
      }
    ],
    "name": "getFeesAndRewards",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_beneficiary",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_organization",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_challenge",
        "type": "uint256"
      }
    ],
    "name": "getFeesAndRewardsTotal",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

const setTimeoutPromise = timeout => new Promise(resolve => setTimeout(resolve, timeout));
module.exports.setTimeoutPromise = setTimeoutPromise;

const getBlock = async (web3, typeOrNumber = 'latest', checkEmptyBlocks = true) => {
  let counter = 0;
  let block;

  const isEmpty = block => checkEmptyBlocks
      ? block.transactions.length === 0
      : false;

  const blockRequest = () => new Promise(resolve => {
    const blockNumberTimeout = setTimeout(() => resolve(null), 2000);
    try {
      web3.eth.getBlock(typeOrNumber, (error, result) => {
        clearTimeout(blockNumberTimeout);

        if (error) {
            return resolve();
        }

        resolve(result);
      });
    } catch (error) {
        // ignore errors due because of we will be doing retries
        resolve(null);
    }
  });

  do {
    const isConnected = () => typeof web3.currentProvider.isConnected === 'function'
      ? web3.currentProvider.isConnected()
      : web3.currentProvider.connected;
    if (!isConnected()) {
      throw new Error(`Unable to fetch block "${typeOrNumber}": no connection`);
    }

    if (counter === 100) {
        counter = 0;
        throw new Error(
          `Unable to fetch block "${typeOrNumber}": retries limit has been reached`
        );
    }

    block = await blockRequest();
    // console.log('>>>', counter, block);

    if (!block) {
        await setTimeoutPromise(parseInt(3000 + 1000 * counter / 5));
    } else {
      await setTimeoutPromise(2500);
    }

    counter++;
  } while (!block || isEmpty(block));

  return block;
};
module.exports.getBlock = getBlock;

const getCurrentBlockNumber = async web3 => {
  const block = await getBlock(web3, 'latest', false);
  return block.number;
};

// Get current block number
const getCurrentBlockNumberOLD = async web3 => {
    let counter = 0;
    let blockNumber;

    const blockNumberRequest = () => new Promise(resolve => {
        const blockNumberTimeout = setTimeout(() => resolve(null), 2000);

        try {
            web3.eth.getBlockNumber((error, result) => {
                clearTimeout(blockNumberTimeout);

                if (error) {
                    return resolve();
                }

                resolve(result);
            });
        } catch (error) {
            // ignore errors due because of we will be doing retries
            resolve(null);
        }
    });

    do {
        if (!web3.currentProvider.connected) {
            throw new Error('Unable to fetch blockNumber: no connection');
        }

        if (counter === 10) {
            throw new Error('Unable to fetch blockNumber: retries limit has been reached');
        }

        blockNumber = await blockNumberRequest();

        if (typeof blockNumber !== 'number') {
            await setTimeoutPromise(1000 + 1000 * parseInt(counter / 3));
        }

        counter++;
    } while (typeof blockNumber !== 'number');

    return blockNumber;
};
module.exports.getCurrentBlockNumber = getCurrentBlockNumber;


// Wait for a specific block number
const waitForBlockNumber = async (web3, blockNumber) => {
    let currentBlockNumber = 0;

    while (currentBlockNumber < blockNumber) {

        try {
            currentBlockNumber = await getCurrentBlockNumber(web3);

            if (blockNumber < currentBlockNumber) {
                break;
            }

            await setTimeoutPromise(1000);
        } catch(error) {
            log.debug('waitForBlockNumber', error.toString());
        }
    }
};
module.exports.waitForBlockNumber = waitForBlockNumber;

// orgid-resolver creation helper
module.exports.createResolver = (web3, options = {}) => {
    const resolver = new OrgIdResolver({
      web3,
      orgId: options.orgIdAddress,
      authorizedTrustProofsIssuers: options.authorizedTrustProofsIssuers
    });
    resolver.registerSocialFetchMethod(twitterFetchMethod, {
      key: options.twitterKey
    });
    resolver.registerFetchMethod(httpFetchMethod);
    return resolver;
};

// Extract assertion from orgid-resolver result
module.exports.getTrustAssertsion = (resolverResult, type, claim) => {

    if (!resolverResult.trust || !resolverResult.trust.assertions) {
        return false;
    }

    return resolverResult.trust.assertions
        .filter(a => a.type === type && a.claim.match(new RegExp(`${claim}`, 'i')))
        .reduce((a, v) => v && v.verified ? true : false, false);
};

const checkSslByUrl = (link, expectedLegalName) => new Promise(async (resolve) => {

    if (link.indexOf('://') === -1) {
        link = `https://${link}`;
    }

    let requestSsl;

    try {
        let { hostname } = new URL(link);
        let isAuthorized = false;

        const options = {
            host: hostname,
            method: 'get',
            path: '/',
            agent: new https.Agent({ maxCachedSessions: 0 })
        };

        let legalNameFromServer;

        requestSsl = https.request(options, (response) => {
            let subject = response.socket.getPeerCertificate().subject;
            legalNameFromServer = subject.O;
            isAuthorized = response.socket.authorized;

            if (legalNameFromServer) {
                resolve(
                    isAuthorized &&
                    legalNameFromServer.includes(expectedLegalName)
                )
            } else {
                resolve(false);
            }
        });
        requestSsl.on('error', (e) => {
          console.error('HTTPS ERROR:', e);
        });
        requestSsl.end();
    } catch (e) {
        log.debug('checkSslByUrl [ERROR]', e.toString());

        resolve(false);
    }
});
module.exports.checkSslByUrl = checkSslByUrl;

class SimpleQueue {
    constructor () {
        this.process = false;
        this.current = null;
        this.queue = [];
    }

    async step () {
        try {
            this.current = this.queue.shift();
            this.process = true;
            await this.current.action.apply(this, this.current.args);
            this.process = false;
            this.next();
        } catch (error) {
            this.process = false;
        }
    }

    next () {
        if (this.process || this.queue.length === 0) {
            return;
        }

        if (this.queue.length > 0) {
            this.step();
        }
    }

    add (action, args) {
        this.queue.push({
            action,
            args
        });
        this.next();
    }
}
module.exports.SimpleQueue = SimpleQueue;

// // Get the Organizations in DNS for the DNS Trust Clue
// const getOrgidFromDns = async (link) => new Promise((resolve) => {
//     try {

//         if (link.indexOf('://') === -1) {
//             link = `https://${link}`;
//         }

//         const myURL = new URL(link);
//         dns.resolveTxt(myURL.hostname, (err, data) => {

//             if (err) {
//                 return resolve(undefined);
//             }

//             let orgid = _.get(
//                 _.filter(
//                     data,
//                     record => record && record.length && record[0].indexOf('orgid=') === 0
//                 ),
//                 '[0][0]',
//                 false
//             );

//             if (orgid) {
//                 orgid = orgid.replace('orgid=', '').replace('did:orgid:');
//             }

//             return resolve(orgid);
//         });
//     } catch (e) {
//         resolve(false)
//     }
// });

// // Get the ORG.ID from Facebook post
// const getOrgIdFromFacebookPost = socialUrl => new Promise(async (resolve) => {

//     try {
//         const orgJsonResponse = await fetch(socialUrl);
//         process.stdout.write('[FB::READ-OK]\n');
//         const orgJsonText = await orgJsonResponse.text();
//         const $ = cheerio.load(orgJsonText);
//         let insideCode = '';
//         let $code;
//         let post = '';
//         const i = 0;

//         do {
//             insideCode = $(`.hidden_elem > code`)
//                 .eq(i++)
//                 .html()
//                 .replace('<!--', '')
//                 .replace('-->', '')
//                 .replace('\"', '"');
//             $code = cheerio.load(insideCode);
//             post = $code('[data-testid="post_message"] > div > p').html();
//         } while (!!$code && !post && i < 20);

//         if (!post) {
//             return resolve(false);
//         }

//         const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
//         resolve(orgid)
//     } catch (e) {
//         log.warn('Error during getOrgIdFromFacebookPost:', e.toString());

//         resolve(false);
//     }
// });

// // Get the ORG.ID from Twitter post
// const getOrgIdFromTwitterPost = (socialUrl) => new Promise(async (resolve) => {
//     try {
//         const orgJsonResponse = await fetch(socialUrl);
//         process.stdout.write('[WT::READ-OK]\n');
//         const orgJsonText = await orgJsonResponse.text();
//         const $ = cheerio.load(orgJsonText);
//         const post = $(`.js-tweet-text`).text();

//         if (!post) {
//             return resolve(false);
//         }

//         const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
//         resolve(orgid)
//     } catch (e) {
//         log.warn('Error during getOrgIdFromFacebookPost:', e.toString());

//         resolve(false)
//     }
// });


// Get DirectoryIndex contract
const getDirIndexContract = (web3, indexAddress) => new web3.eth.Contract(DIR_INDEX_ABI, indexAddress);

// Get ArbitrableDirectory contract
const getArbDirContract = (web3, address) => new web3.eth.Contract(ARB_DIR_ABI, address);

const fetchDirectoriesIndex = async (web3, indexAddress) => {
    const index = getDirIndexContract(web3, indexAddress);
    return index.methods.getSegments().call();
};
module.exports.fetchDirectoriesIndex = fetchDirectoriesIndex;

const fetchDirectoryName = async (web3, address) => {
  const dir = getArbDirContract(web3, address);
  return dir.methods.getSegment().call();
};
module.exports.fetchDirectoryName = fetchDirectoryName;

const subscribeDirectoriesEvents = (web3, fromBlock, directories, callback) => directories.map(address => {
    const dir = getArbDirContract(web3, address);
    const events = {}; // events log
    const subscription = dir.events.allEvents(
        {
            fromBlock
        },
        (error, evt) => {
            if (error) {
                log.error(error);
                return;
            }
            if (!events[evt.id]) {
                log.debug(`Directory event: "${evt.event}"`, evt.id, evt.returnValues);
                events[evt.id] = evt;
                callback(evt);
            } else {
                log.debug('Known Event:', evt.event);
            }
        }
    );
    log.debug('Subscribed to directory:', address);
    return subscription;
});
module.exports.subscribeDirectoriesEvents = subscribeDirectoriesEvents;

const unsubscribeDirectoriesEvents = (subscriptions = []) => subscriptions.forEach(
    subscription => subscription.unsubscribe()
);
module.exports.unsubscribeDirectoriesEvents = unsubscribeDirectoriesEvents;

// Create JWT token
const createToken = (
  privPem,
  issuer,
  fragment,
  audience,
  scope,
  expiresIn
) => {
  const priv = JWK.asKey(
    privPem,
    {
      alg: 'ES256K',
      use: 'sig'
    }
  );

  return JWT.sign(
    {
      scope: Array.isArray(scope) ? JSON.parse(scope) : scope
    },
    priv,
    {
      audience,
      ...(issuer ? { issuer: `${issuer}${fragment ? '#' + fragment : ''}` } : {}),
      expiresIn,
      kid: false,
      header: { typ: 'JWT' }
    }
  );
}
module.exports.createToken = createToken;

// Send HTTP request
const httpRequest = async (
  baseURL,
  apiPath,
  method,
  data,
  auth
) => {
  const url = `${baseURL}${apiPath}`;
  const timeout = 20000;

  // COnfigure connection timeout handler
  const cancelTokenSource = axios.CancelToken.source();
  let connectionTimeout = setTimeout(
    () => cancelTokenSource
      .cancel(
        `Cannot connect to the source: ${baseURL}${apiPath}`
      ),
    timeout
  );

  console.log('HEADERS', {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip,deflate',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...(
      method !== 'get'
        ? { 'Content-Type': 'application/json' }
        : {}
    ),
    ...(
      auth && auth.method === 'headers'
        ? auth.data
        : {}
    )
  });

  try {
    // Make a call
    const response = await axios({
      url,
      method,
      timeout,
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip,deflate',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...(
          method !== 'get'
            ? { 'Content-Type': 'application/json' }
            : {}
        ),
        ...(
          auth && auth.method === 'headers'
            ? auth.data
            : {}
        )
      },
      data: {
        ...data,
        ...(
          auth && auth.method === 'body'
            ? auth.data
            : {}
        )
      },
      cancelToken: cancelTokenSource.token
    });

    clearTimeout(connectionTimeout);
    return response.data;
  } catch (error) {

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error', error.message);
    }

    throw new Error(
      error.message
    );
  }
};
module.exports.httpRequest = httpRequest;

const toChecksObject = checks => checks.reduce(
  (a, {
    type,
    passed,
    errors = [],
    warnings = []
  }) => {
    a = {
      ...a,
      [type]: {
        passed,
        errors,
        warnings
      }
    };
    return a;
  }, {}
);

// Verify token
const verifyToken = async (orgIdResolver, token) => {

  // If passed headers object
  // then extract token from authorization header
  if (typeof token === 'object') {

    if (!token.authorization) {
      throw createError(
        'Authorization missing',
        403
      );
    }

    let [ type, authToken ] = token.authorization.split(' ');

    if (type !== 'Bearer') {
      throw createError(
        'Unknown authorization method',
        403
      );
    }

    token = authToken;
  }

  const decodedToken = JWT.decode(token, {
      complete: true
  });
  const { payload: { exp, iss } } = decodedToken;

  // Token should not be expired
  if (exp < (Date.now() / 1000)) {
    throw createError(
          'Token is expired',
          403
      );
  }

  // Issuer should be defined
  if (!iss || iss === '') {
      throw createError(
          'Token is missing issuing ORGiD',
          403
      );
  }

  // Resolve did to didDocument
  const { did } = iss.match(/(?<did>did:orgid:0x\w{64})(?:#{1})?(?<fragment>\w+)?/).groups;
  const didResult = await orgIdResolver.resolve(did);
  const checks = toChecksObject(didResult.checks);

  // didDocument should be resolved
  if (!checks.DID_DOCUMENT.passed) {
      throw createError(
          checks.DID_DOCUMENT.errors.join('; '),
          403
      );
  }

  // Organization should not be disabled
  if (!didResult.organization.isActive) {
      throw createError(
          `Organization: ${didResult.organization.orgId} is disabled`,
          403
      );
  }

  // Validate signature of the organization owner or director
  const lastPeriod = token.lastIndexOf('.');
  const jwtMessage = token.substring(0, lastPeriod);
  let rawSign = decodedToken.signature
      .toString()
      .replace('-', '+')
      .replace('_', '/');
  const signatureB16 = Buffer
      .from(
          rawSign,
          'base64'
      )
      .toString('hex');

  const hashedMessage = ethers.utils.hashMessage(jwtMessage);
  const signingAddress = ethers.utils.recoverAddress(hashedMessage, `0x${signatureB16}`);

  // Signer address should be an owner address or director address
  // and director have to be confirmed
  if (
      ![
          didResult.organization.owner,
          ...(didResult.organization.director !== '0x0000000000000000000000000000000000000000'
              && didResult.organization.isDirectorshipAccepted
              ? [didResult.organization.director]
              : []
          )
      ].includes(signingAddress)
  ) {
      throw createError(
          'Token is signed by unknown key',
      403);
  }

  return decodedToken;
};
module.exports.verifyToken = verifyToken;

const createError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};
module.exports.createError = createError;
