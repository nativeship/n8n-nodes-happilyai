"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Happilyai = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Happilyai {
    constructor() {
        this.description = {
            displayName: "HappilyAI",
            name: "happilyai",
            icon: {
                light: "file:happilyai.svg",
                dark: "file:happilyai.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"members\\\":\\u007b\\\"getMembers\\\":\\\"listMembers: member\\\",\\\"getUserProfile\\\":\\\"getAMemberSEngagementProfile: member\\\",\\\"importMembers\\\":\\\"importOrSyncMembers: member\\\"\\u007d,\\\"performance\\\":\\u007b\\\"createPerformanceBoosts\\\":\\\"submitPerformanceBoosts: performance\\\",\\\"getPerformanceFeedbacks\\\":\\\"listPerformanceFeedback: performance\\\",\\\"savePerformancePreset\\\":\\\"saveAPerformanceReviewPreset: performance\\\"\\u007d,\\\"recognition\\\":\\u007b\\\"createRecognition\\\":\\\"sendRecognition: recognition\\\",\\\"getMedalById\\\":\\\"getAMedal: recognition\\\",\\\"getRecognitions\\\":\\\"listReceivedRecognition: recognition\\\"\\u007d,\\\"surveys\\\":\\u007b\\\"getQuestions\\\":\\\"listSurveyQuestions: survey\\\",\\\"getResponses\\\":\\\"listSurveyResponses: survey\\\"\\u007d,\\\"townHall\\\":\\u007b\\\"generateTownHallContent\\\":\\\"generateTownHallContent: townHall\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "Happily.ai helps teams improve engagement and performance through recognition, feedback, and people analytics",
            documentationUrl: "https://api.happily.ai/prod",
            hints: [
                {
                    message: "Operation \"getMembers\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getPerformanceFeedbacks\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getQuestions\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getRecognitions\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getResponses\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "The specification defines multiple document destinations; the generated node exposes them as an explicit destination choice. Name the destinations clearly so users can choose the intended environment, or keep one document destination to remove this warning.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "HappilyAI"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "happilyaiApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "members",
                    options: [
                        {
                            name: "Member",
                            value: "members"
                        },
                        {
                            name: "Performance",
                            value: "performance"
                        },
                        {
                            name: "Recognition",
                            value: "recognition"
                        },
                        {
                            name: "Survey",
                            value: "surveys"
                        },
                        {
                            name: "Town Hall",
                            value: "townHall"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ]
                        }
                    },
                    default: "getMembers",
                    options: [
                        {
                            name: "Get A Member'S Engagement Profile",
                            value: "getUserProfile",
                            action: "Get member s engagement profile",
                            description: "Retrieve a member profile with impact rating and engagement health. personal context is included by default; use `include_personal_context` and `context_limit` to control it."
                        },
                        {
                            name: "Import Or Sync",
                            value: "importMembers",
                            action: "Import or sync members",
                            description: "Import up to 1,000 members; each needs an email. invalid emails or unsupported fields fail validation. set `skip_duplicates` or `update_if_exists` as needed. jobs may run asynchronously; check status with `import_id`. limit: 10 requests/min. \u26A0 HTTP method inferred; path only confirmed."
                        },
                        {
                            name: "List",
                            value: "getMembers",
                            action: "List members",
                            description: "List company members. provide at least one of `email`, `team_id`, `talent_type`, or `company_id`. an email filter returns one member; otherwise results are paginated."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "getMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Company ID",
                            name: "company_id",
                            type: "string",
                            default: "",
                            description: "Filter by company ID"
                        },
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Return a single member by email",
                            placeholder: "name@email.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Talent Type",
                            name: "talent_type",
                            type: "string",
                            default: "",
                            description: "Filter by talent type"
                        },
                        {
                            displayName: "Team ID",
                            name: "team_id",
                            type: "string",
                            default: "",
                            description: "Filter by internal team ID"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "getMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Email",
                    name: "email",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The member's email address",
                    placeholder: "e.g. jordan@acme.com",
                    hint: "Expected format: email",
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "getUserProfile"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "getUserProfile"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Context Limit",
                            name: "context_limit",
                            type: "number",
                            default: 10,
                            description: "Max items per personal-context list. 1\u201350, default 10.",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 50
                            }
                        },
                        {
                            displayName: "Include Personal Context",
                            name: "include_personal_context",
                            type: "boolean",
                            default: true,
                            description: "Whether include the `personal_context` block. defaults to `true`."
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "getUserProfile"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Members",
                    name: "members",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Member records to import",
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "importMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "importMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Options",
                            name: "options",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Skip Duplicates",
                                    name: "skip_duplicates",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether skip members whose email already exists"
                                },
                                {
                                    displayName: "Update If Exists",
                                    name: "update_if_exists",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether update members whose email already exists"
                                }
                            ],
                            description: "Options for handling duplicate member emails"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "members"
                            ],
                            operation: [
                                "importMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ]
                        }
                    },
                    default: "createPerformanceBoosts",
                    options: [
                        {
                            name: "List Performance Feedback",
                            value: "getPerformanceFeedbacks",
                            action: "List performance feedback",
                            description: "List feedback for an employee (`email`), a reviewer (`reviewer_email`), or both. at least one is required; optional date filters limit the period. performance."
                        },
                        {
                            name: "Save A Performance Review Preset",
                            value: "savePerformancePreset",
                            action: "Save performance review preset",
                            description: "Create a reusable review preset for up to 50 teams or 50 members. supply either `teams` or `members`; overlapping assignments are removed from existing presets. performance."
                        },
                        {
                            name: "Submit Performance Boosts",
                            value: "createPerformanceBoosts",
                            action: "Submit performance boosts",
                            description: "Submit up to 200 boosts; each returns a result. the reviewer must directly manage the employee; both must be company members; goal and culture sections need `supporting_examples`. one review per member per cycle. \u26A0 the gateway exposes `/1` and `/API/v1`; the canonical path is unconfirmed. performance."
                        }
                    ]
                },
                {
                    displayName: "Body JSON",
                    name: "bodyJson",
                    type: "json",
                    default: {
                        schemaAlternative: "alternative1",
                        value: ""
                    },
                    required: true,
                    description: "Raw request body",
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "createPerformanceBoosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "createPerformanceBoosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "getPerformanceFeedbacks"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Date From",
                            name: "date_from",
                            type: "string",
                            default: "",
                            description: "Inclusive start date, `yyyy-mm-dd`",
                            placeholder: "e.g. 2026-01-01"
                        },
                        {
                            displayName: "Date To",
                            name: "date_to",
                            type: "string",
                            default: "",
                            description: "Inclusive end date, `yyyy-mm-dd`",
                            placeholder: "e.g. 2026-06-30"
                        },
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Employee (receiver) email. required unless `reviewer_email` is given.",
                            placeholder: "name@email.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Reviewer Email",
                            name: "reviewer_email",
                            type: "string",
                            default: "",
                            description: "Reviewer (sender) email. required unless `email` is given.",
                            hint: "Expected format: email"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "getPerformanceFeedbacks"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Culture Contribution",
                    name: "culture_contribution",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Prompt for feedback on culture contribution",
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Goals Feedback",
                    name: "goals_feedback",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Prompt for feedback on goal performance",
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Next Review",
                    name: "next_review",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Date of the next review in `yyyy-mm-dd` format",
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Members",
                            name: "members",
                            type: "json",
                            default: [],
                            description: "Member email addresses to assign. provide this or `teams`, up to 50."
                        },
                        {
                            displayName: "Teams",
                            name: "teams",
                            type: "json",
                            default: [],
                            description: "Internal team IDs to assign. provide this or `members`, up to 50."
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "performance"
                            ],
                            operation: [
                                "savePerformancePreset"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ]
                        }
                    },
                    default: "createRecognition",
                    options: [
                        {
                            name: "Get A Medal",
                            value: "getMedalById",
                            action: "Get medal recognition",
                            description: "Return the configured value for a medal ID; if none is configured, `value` echoes `medal_id`. \u26A0 verified only in a request fixture. recognition."
                        },
                        {
                            name: "List Received",
                            value: "getRecognitions",
                            action: "List received recognition",
                            description: "Retrieve recognition received by exactly one member (`email`) or team (`team_name`). results are paginated, newest first."
                        },
                        {
                            name: "Send",
                            value: "createRecognition",
                            action: "Send recognition",
                            description: "Send recognition coins to email recipients, `all_members`, a team, or a cohort. emails may be passed singly, comma-separated, or as an array. the sender must belong to the company; unknown individual emails return 503, while unknown teams or cohorts are skipped."
                        }
                    ]
                },
                {
                    displayName: "Member Email",
                    name: "member_email",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Email of the member sending the recognition",
                    placeholder: "e.g. sam@acme.com",
                    hint: "Expected format: email",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Amount",
                    name: "amount",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "Number of recognition coins to give",
                    placeholder: "e.g. 5",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    }
                },
                {
                    displayName: "For",
                    name: "for",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Reason or message accompanying the recognition",
                    placeholder: "e.g. Shipping the Q3 launch ahead of schedule \uD83D\uDE80",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Recipients",
                    name: "recipients",
                    type: "json",
                    default: {
                        schemaAlternative: "alternative1",
                        value: ""
                    },
                    required: true,
                    description: "Email addresses, `all_members`, team IDs, or cohort IDs. email values may be one address, a comma-separated string, or an array.",
                    placeholder: "e.g. jordan@acme.com,sam@acme.com",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Type",
                    name: "type",
                    type: "options",
                    default: "coin",
                    required: true,
                    description: "Recognition type; the supported value is `coin`",
                    options: [
                        {
                            name: "Coin",
                            value: "coin"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Display Feed",
                            name: "display_feed",
                            type: "boolean",
                            default: false,
                            description: "Whether to show the recognition in the public feed"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "status",
                        "type",
                        "amount",
                        "company",
                        "createdate",
                        "for",
                        "share",
                        "statusCode",
                        "total",
                        "when"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Amount",
                            value: "amount"
                        },
                        {
                            name: "Company",
                            value: "company"
                        },
                        {
                            name: "Createdate",
                            value: "createdate"
                        },
                        {
                            name: "For",
                            value: "for"
                        },
                        {
                            name: "Share",
                            value: "share"
                        },
                        {
                            name: "Status",
                            value: "status"
                        },
                        {
                            name: "StatusCode",
                            value: "statusCode"
                        },
                        {
                            name: "To",
                            value: "to"
                        },
                        {
                            name: "Total",
                            value: "total"
                        },
                        {
                            name: "Type",
                            value: "type"
                        },
                        {
                            name: "When",
                            value: "when"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "createRecognition"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Medal ID",
                    name: "medal_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The medal identifier (e.g. `kindness`)",
                    placeholder: "e.g. Kindness",
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "getMedalById"
                            ]
                        }
                    }
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "getMedalById"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "getRecognitions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Email of the member whose received recognition you want. required unless `team_name` is given.",
                            placeholder: "e.g. jordan@acme.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Team Name",
                            name: "team_name",
                            type: "string",
                            default: "",
                            description: "Team name whose received recognition you want. required unless `email` is given.",
                            placeholder: "e.g. Design"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "recognition"
                            ],
                            operation: [
                                "getRecognitions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "surveys"
                            ]
                        }
                    },
                    default: "getQuestions",
                    options: [
                        {
                            name: "List Survey Questions",
                            value: "getQuestions",
                            action: "List survey questions",
                            description: "List custom and shared main survey questions. filter by `type`, `skill`, or `dimension`."
                        },
                        {
                            name: "List Survey Responses",
                            value: "getResponses",
                            action: "List survey responses",
                            description: "List survey responses by respondent email, question ID, or both. at least one is required; use `date_from` and `date_to` to limit the period."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "surveys"
                            ],
                            operation: [
                                "getQuestions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Dimension",
                            name: "dimension",
                            type: "string",
                            default: "",
                            description: "Filter by question dimension/category"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Skill",
                            name: "skill",
                            type: "options",
                            default: "Critical Thinking",
                            description: "Filter by powerup skill",
                            options: [
                                {
                                    name: "Critical Thinking",
                                    value: "Critical Thinking"
                                },
                                {
                                    name: "Empathy",
                                    value: "Empathy"
                                },
                                {
                                    name: "Initiative Making",
                                    value: "Initiative Making"
                                },
                                {
                                    name: "Leadership",
                                    value: "Leadership"
                                },
                                {
                                    name: "Optimism",
                                    value: "Optimism"
                                },
                                {
                                    name: "Self Awareness",
                                    value: "Self Awareness"
                                }
                            ]
                        },
                        {
                            displayName: "Type",
                            name: "type",
                            type: "string",
                            default: "",
                            description: "Filter by question type (e.g. `multiple choice`)"
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "surveys"
                            ],
                            operation: [
                                "getQuestions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "surveys"
                            ],
                            operation: [
                                "getResponses"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Date From",
                            name: "date_from",
                            type: "string",
                            default: "",
                            description: "Inclusive start date, `yyyy-mm-dd`",
                            placeholder: "e.g. 2026-01-01"
                        },
                        {
                            displayName: "Date To",
                            name: "date_to",
                            type: "string",
                            default: "",
                            description: "Inclusive end date, `yyyy-mm-dd`",
                            placeholder: "e.g. 2026-06-30"
                        },
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Respondent email. required unless `question_id` is given.",
                            placeholder: "name@email.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Question ID",
                            name: "question_id",
                            type: "string",
                            default: "",
                            description: "Question ID. required unless `email` is given."
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "surveys"
                            ],
                            operation: [
                                "getResponses"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "townHall"
                            ]
                        }
                    },
                    default: "generateTownHallContent",
                    options: [
                        {
                            name: "Generate Town Hall Content",
                            value: "generateTownHallContent",
                            action: "Generate town hall content",
                            description: "Generate town hall feed content asynchronously. no request body is required; the API key identifies the company. the company must be active and have town hall enabled. \u26A0 path is unconfirmed and may be internal-only."
                        }
                    ]
                },
                {
                    displayName: "Options",
                    name: "options",
                    type: "collection",
                    placeholder: "Add Option",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "townHall"
                            ],
                            operation: [
                                "generateTownHallContent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Destination",
                            name: "serverChoice",
                            type: "options",
                            default: "documentServer1HttpsApiHappilyAiProd",
                            options: [
                                {
                                    name: "Production",
                                    value: "documentServer1HttpsApiHappilyAiProd",
                                    description: "Endpoint: https://api.happily.ai/prod"
                                },
                                {
                                    name: "Staging",
                                    value: "documentServer2HttpsApiHappilyAiStaging",
                                    description: "Endpoint: https://api.happily.ai/staging"
                                },
                                {
                                    name: "Development / Sandbox",
                                    value: "documentServer3HttpsApiHappilyAiDev",
                                    description: "Endpoint: https://api.happily.ai/dev"
                                },
                                {
                                    name: "Direct API Gateway Invoke URL (Prod, Us East 2)",
                                    value: "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd",
                                    description: "Endpoint: https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod"
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "getMembers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/1/members";
                        const qs = {};
                        const body = {};
                        if (additionalFields["email"] !== undefined)
                            qs["email"] = additionalFields["email"];
                        if (additionalFields["team_id"] !== undefined)
                            qs["team_id"] = additionalFields["team_id"];
                        if (additionalFields["talent_type"] !== undefined)
                            qs["talent_type"] = additionalFields["talent_type"];
                        if (additionalFields["company_id"] !== undefined)
                            qs["company_id"] = additionalFields["company_id"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["member", "members", "message", "pagination", "statusCode"], simplified: ["member", "members", "message", "pagination", "statusCode"] };
                        errorPlan = { "400": { "title": "Missing or invalid request parameters." } };
                        break;
                    }
                    case "getUserProfile": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v1/users/{email}/profile";
                        const qs = {};
                        const body = {};
                        path = path.split("{email}").join(encodeURIComponent(String(this.getNodeParameter("email", itemIndex))));
                        if (additionalFields["include_personal_context"] !== undefined)
                            qs["include_personal_context"] = additionalFields["include_personal_context"];
                        if (additionalFields["context_limit"] !== undefined)
                            qs["context_limit"] = additionalFields["context_limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["engagement_health_score", "engagement_health_status", "impact_rating", "metadata", "personal_context", "user"], simplified: ["engagement_health_score", "engagement_health_status", "impact_rating", "metadata", "personal_context", "user"] };
                        errorPlan = { "403": { "title": "Authenticated, but not permitted to access this resource." }, "404": { "title": "The requested resource was not found." } };
                        break;
                    }
                    case "importMembers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/members";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "members", "displayName": "Members", "description": "Member records to import.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "country", "displayName": "Country", "description": "Two-letter uppercase country code, such as `US` or `TH`.", "type": "string", "default": "TH", "pattern": "^[A-Z]{2}$" }, { "name": "email", "displayName": "Email", "type": "string", "format": "email", "required": true }, { "name": "first_name", "displayName": "First name", "description": "Required; must not be blank or include leading or trailing spaces.", "type": "string", "required": true }, { "name": "language", "displayName": "Language", "description": "Lowercase language code, such as `en` or `th`.", "type": "string", "default": "en", "pattern": "^[a-z]{2,5}$" }, { "name": "last_name", "displayName": "Last name", "description": "Member last name.", "type": "string", "required": true }, { "name": "manager_email", "displayName": "Manager email", "description": "Email address of the member manager.", "type": "string", "format": "email" }, { "name": "team_name", "displayName": "Team name", "description": "Team name. Happily.ai creates the team if it does not exist.", "type": "string" }, { "name": "timezone", "displayName": "Timezone", "type": "integer", "minValue": -12, "maxValue": 14, "default": 7 }] } }, this.getNodeParameter("members", itemIndex), this, itemIndex);
                        if (additionalFields["options"] !== undefined)
                            setBodyField(body, { "name": "options", "displayName": "Options", "description": "Options for handling duplicate member emails.", "type": "object", "representation": "raw", "fields": [{ "name": "skip_duplicates", "displayName": "Skip duplicates", "description": "Skip members whose email already exists.", "type": "boolean", "default": false }, { "name": "update_if_exists", "displayName": "Update if exists", "description": "Update members whose email already exists.", "type": "boolean", "default": false }] }, additionalFields["options"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["details", "import_id", "rate_limit", "status", "summary"], simplified: ["details", "import_id", "rate_limit", "status", "summary"] };
                        errorPlan = { "400": { "title": "Validation failed — one or more members are invalid." }, "429": { "title": "Rate limit exceeded for this API key." } };
                        break;
                    }
                    case "createPerformanceBoosts": {
                        const path = "/api/v1/performance-boosts";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Raw request body", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "object", "fields": [{ "name": "assessment_data", "displayName": "Assessment data", "type": "object", "required": true, "description": "Goal and culture ratings with supporting examples, plus optional development guidance.", "fields": [{ "name": "culture_contribution", "displayName": "Culture contribution", "type": "object", "required": true, "description": "Culture rating and supporting examples.", "fields": [{ "name": "rating", "displayName": "Rating", "type": "string", "required": true, "description": "Rating for culture contribution.", "enum": ["significantly", "consistently", "somewhat", "rarely"] }, { "name": "supporting_examples", "displayName": "Supporting examples", "type": "string", "required": true, "description": "Examples supporting the culture contribution rating." }], "representation": "raw" }, { "name": "future_development", "displayName": "Future development", "type": "object", "description": "Optional goals, outcomes, and skill recommendations for future development.", "fields": [{ "name": "goals_targets_outcomes", "displayName": "Goals targets outcomes", "type": "string" }, { "name": "skill_recommendations", "displayName": "Skill recommendations", "type": "string" }], "representation": "raw" }, { "name": "goal_performance", "displayName": "Goal performance", "type": "object", "required": true, "description": "Goal rating and supporting examples.", "fields": [{ "name": "rating", "displayName": "Rating", "type": "string", "required": true, "description": "Rating for goal performance.", "enum": ["exceeded_goals", "met_goals", "partially_met_goals", "did_not_meet_goals"] }, { "name": "supporting_examples", "displayName": "Supporting examples", "type": "string", "required": true, "description": "Examples supporting the goal performance rating." }], "representation": "raw" }], "representation": "raw" }, { "name": "employee_email", "displayName": "Employee email", "type": "string", "format": "email", "required": true, "description": "Email address of the employee being reviewed." }, { "name": "review_date", "displayName": "Review date", "type": "string", "format": "date", "required": true, "description": "Review date in `YYYY-MM-DD` format." }, { "name": "reviewer_email", "displayName": "Reviewer email", "type": "string", "format": "email", "required": true, "description": "Email address of the employee direct manager." }], "representation": "raw" }, { "name": "alternative2", "displayName": "Alternative2", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "object", "fields": [{ "name": "assessment_data", "displayName": "Assessment data", "type": "object", "required": true, "description": "Goal and culture ratings with supporting examples, plus optional development guidance.", "fields": [{ "name": "culture_contribution", "displayName": "Culture contribution", "type": "object", "required": true, "description": "Culture rating and supporting examples.", "fields": [{ "name": "rating", "displayName": "Rating", "type": "string", "required": true, "description": "Rating for culture contribution.", "enum": ["significantly", "consistently", "somewhat", "rarely"] }, { "name": "supporting_examples", "displayName": "Supporting examples", "type": "string", "required": true, "description": "Examples supporting the culture contribution rating." }], "representation": "raw" }, { "name": "future_development", "displayName": "Future development", "type": "object", "description": "Optional goals, outcomes, and skill recommendations for future development.", "fields": [{ "name": "goals_targets_outcomes", "displayName": "Goals targets outcomes", "type": "string" }, { "name": "skill_recommendations", "displayName": "Skill recommendations", "type": "string" }], "representation": "raw" }, { "name": "goal_performance", "displayName": "Goal performance", "type": "object", "required": true, "description": "Goal rating and supporting examples.", "fields": [{ "name": "rating", "displayName": "Rating", "type": "string", "required": true, "description": "Rating for goal performance.", "enum": ["exceeded_goals", "met_goals", "partially_met_goals", "did_not_meet_goals"] }, { "name": "supporting_examples", "displayName": "Supporting examples", "type": "string", "required": true, "description": "Examples supporting the goal performance rating." }], "representation": "raw" }], "representation": "raw" }, { "name": "employee_email", "displayName": "Employee email", "type": "string", "format": "email", "required": true, "description": "Email address of the employee being reviewed." }, { "name": "review_date", "displayName": "Review date", "type": "string", "format": "date", "required": true, "description": "Review date in `YYYY-MM-DD` format." }, { "name": "reviewer_email", "displayName": "Reviewer email", "type": "string", "format": "email", "required": true, "description": "Email address of the employee direct manager." }], "representation": "raw" }, "representation": "raw" }], "composition": "oneOf", "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["body", "statusCode"], simplified: ["body", "statusCode"] };
                        errorPlan = { "400": { "title": "Missing or invalid request parameters." }, "500": { "title": "Unexpected server error." } };
                        break;
                    }
                    case "getPerformanceFeedbacks": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/1/performance_feedback";
                        const qs = {};
                        const body = {};
                        if (additionalFields["email"] !== undefined)
                            qs["email"] = additionalFields["email"];
                        if (additionalFields["reviewer_email"] !== undefined)
                            qs["reviewer_email"] = additionalFields["reviewer_email"];
                        if (additionalFields["date_from"] !== undefined)
                            qs["date_from"] = additionalFields["date_from"];
                        if (additionalFields["date_to"] !== undefined)
                            qs["date_to"] = additionalFields["date_to"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["feedback", "message", "pagination", "statusCode"], simplified: ["feedback", "message", "pagination", "statusCode"] };
                        errorPlan = { "400": { "title": "Missing or invalid request parameters." } };
                        break;
                    }
                    case "savePerformancePreset": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/api/v1/performance-preset";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "culture_contribution", "displayName": "Culture contribution", "description": "Prompt for feedback on culture contribution.", "type": "string", "required": true }, this.getNodeParameter("culture_contribution", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "goals_feedback", "displayName": "Goals feedback", "description": "Prompt for feedback on goal performance.", "type": "string", "required": true }, this.getNodeParameter("goals_feedback", itemIndex), this, itemIndex);
                        if (additionalFields["members"] !== undefined)
                            setBodyField(body, { "name": "members", "displayName": "Members", "description": "Member email addresses to assign. Provide this or `teams`, up to 50.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "format": "email" } }, additionalFields["members"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "next_review", "displayName": "Next review", "description": "Date of the next review in `YYYY-MM-DD` format.", "type": "string", "format": "date", "required": true }, this.getNodeParameter("next_review", itemIndex), this, itemIndex);
                        if (additionalFields["teams"] !== undefined)
                            setBodyField(body, { "name": "teams", "displayName": "Teams", "description": "Internal team IDs to assign. Provide this or `members`, up to 50.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["teams"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "message", "statusCode"], simplified: ["data", "message", "statusCode"] };
                        errorPlan = { "403": { "title": "Authenticated, but not permitted to access this resource." } };
                        break;
                    }
                    case "createRecognition": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/1/recognition/{member_email}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{member_email}").join(encodeURIComponent(String(this.getNodeParameter("member_email", itemIndex))));
                        setBodyField(body, { "name": "amount", "displayName": "Amount", "description": "Number of recognition coins to give.", "type": "number", "required": true, "example": 5 }, this.getNodeParameter("amount", itemIndex), this, itemIndex);
                        if (additionalFields["display_feed"] !== undefined)
                            setBodyField(body, { "name": "display_feed", "displayName": "Display feed", "description": "Whether to show the recognition in the public feed.", "type": "boolean", "default": false }, additionalFields["display_feed"], this, itemIndex);
                        setBodyField(body, { "name": "for", "displayName": "For", "description": "Reason or message accompanying the recognition.", "type": "string", "required": true, "example": "Shipping the Q3 launch ahead of schedule 🚀" }, this.getNodeParameter("for", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "recipients", "displayName": "Recipients", "description": "Email addresses, `ALL_MEMBERS`, team IDs, or cohort IDs. Email values may be one address, a comma-separated string, or an array.", "type": "alternative", "required": true, "example": ["jordan@acme.com", "sam@acme.com"], "composition": "oneOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "description": "One email, comma-separated emails, `ALL_MEMBERS`, or one team or cohort ID.", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "description": "An array of recipient email addresses.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, this.getNodeParameter("recipients", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "type", "displayName": "Type", "description": "Recognition type; the supported value is `coin`.", "type": "string", "required": true, "enum": ["coin"] }, this.getNodeParameter("type", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["amount", "company", "createdate", "for", "share", "status", "statusCode", "to", "total", "type", "when"], simplified: ["status", "type", "amount", "company", "createdate", "for", "share", "statusCode", "total", "when"] };
                        errorPlan = { "403": { "title": "Missing or invalid API key." }, "503": { "title": "A sender or recipient email was not found in your company." } };
                        break;
                    }
                    case "getMedalById": {
                        let path = "/1/recognition/medal/{medal_id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{medal_id}").join(encodeURIComponent(String(this.getNodeParameter("medal_id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["statusCode", "value"], simplified: ["statusCode", "value"] };
                        errorPlan = { "403": { "title": "Missing or invalid API key." } };
                        break;
                    }
                    case "getRecognitions": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/1/recognition";
                        const qs = {};
                        const body = {};
                        if (additionalFields["email"] !== undefined)
                            qs["email"] = additionalFields["email"];
                        if (additionalFields["team_name"] !== undefined)
                            qs["team_name"] = additionalFields["team_name"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message", "pagination", "recognitions", "statusCode"], simplified: ["message", "pagination", "recognitions", "statusCode"] };
                        errorPlan = { "400": { "title": "Missing or invalid request parameters." } };
                        break;
                    }
                    case "getQuestions": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/1/questions";
                        const qs = {};
                        const body = {};
                        if (additionalFields["type"] !== undefined)
                            qs["type"] = additionalFields["type"];
                        if (additionalFields["skill"] !== undefined)
                            qs["skill"] = additionalFields["skill"];
                        if (additionalFields["dimension"] !== undefined)
                            qs["dimension"] = additionalFields["dimension"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message", "pagination", "questions", "statusCode"], simplified: ["message", "pagination", "questions", "statusCode"] };
                        errorPlan = { "403": { "title": "Missing or invalid API key." } };
                        break;
                    }
                    case "getResponses": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/1/responses";
                        const qs = {};
                        const body = {};
                        if (additionalFields["email"] !== undefined)
                            qs["email"] = additionalFields["email"];
                        if (additionalFields["question_id"] !== undefined)
                            qs["question_id"] = additionalFields["question_id"];
                        if (additionalFields["date_from"] !== undefined)
                            qs["date_from"] = additionalFields["date_from"];
                        if (additionalFields["date_to"] !== undefined)
                            qs["date_to"] = additionalFields["date_to"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message", "pagination", "responses", "statusCode"], simplified: ["message", "pagination", "responses", "statusCode"] };
                        errorPlan = { "400": { "title": "Missing or invalid request parameters." } };
                        break;
                    }
                    case "generateTownHallContent": {
                        const path = "/townhall/content";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsApiHappilyAiProd", "url": "https://api.happily.ai/prod", "kind": "selectable", "variables": [] }, { "id": "documentServer2HttpsApiHappilyAiStaging", "url": "https://api.happily.ai/staging", "kind": "fixed", "variables": [] }, { "id": "documentServer3HttpsApiHappilyAiDev", "url": "https://api.happily.ai/dev", "kind": "selectable", "variables": [] }, { "id": "documentServer4HttpsLn1buvf68hExecuteApiUsEast2AmazonawsComProd", "url": "https://ln1buvf68h.execute-api.us-east-2.amazonaws.com/prod", "kind": "fixed", "variables": [] }], "documentServer1HttpsApiHappilyAiProd", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "happilyaiApi", "type": "apiKey", "location": "header", "parameter": "x-api-key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message", "statusCode"], simplified: ["message", "statusCode"] };
                        errorPlan = { "403": { "title": "Company inactive or Town Hall not enabled." } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Happilyai = Happilyai;
//# sourceMappingURL=Happilyai.node.js.map