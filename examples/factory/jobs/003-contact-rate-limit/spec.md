# Rate-limit the contact form

> Feature: Rate-limit the contact form

## Context
`src/components/Post/Meta.js` renders the post header.

## Requirements
1. Rate-limit the contact form.

## Acceptance criteria
1. AC-1: A 6th submission within a minute is rejected. Check: `node scripts/check-rate.js`
2. AC-2: Lint passes. Check: `npx eslint src/components/Contact`

## Out of scope
Redesigning the header.

## Assumptions
- Average reading speed is 200 words per minute: common default.
