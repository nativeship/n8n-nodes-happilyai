# HappilyAI n8n community node

Happily.ai helps teams improve engagement and performance through recognition, feedback, and people analytics

Generated from OpenAPI 1.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `GET /1/members` - List members
  - Retry Contract: none
  - Pagination Contract: none
- `GET /api/v1/users/{email}/profile` - Get a member's engagement profile
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/members` - Import or sync members
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/performance-boosts` - Submit performance boosts
  - Retry Contract: none
  - Pagination Contract: none
- `GET /1/performance_feedback` - List performance feedback
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v1/performance-preset` - Save a performance review preset
  - Retry Contract: none
  - Pagination Contract: none
- `POST /1/recognition/{member_email}` - Send recognition
  - Retry Contract: none
  - Pagination Contract: none
- `GET /1/recognition/medal/{medal_id}` - Get a medal
  - Retry Contract: none
  - Pagination Contract: none
- `GET /1/recognition` - List received recognition
  - Retry Contract: none
  - Pagination Contract: none
- `GET /1/questions` - List survey questions
  - Retry Contract: none
  - Pagination Contract: none
- `GET /1/responses` - List survey responses
  - Retry Contract: none
  - Pagination Contract: none
- `POST /townhall/content` - Generate Town Hall content
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **HappilyAI** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **HappilyAI** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **HappilyAI** display name.
