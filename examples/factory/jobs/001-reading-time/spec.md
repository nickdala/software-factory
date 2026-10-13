# Reading time on posts

> Feature: Reading time on posts

## Context
`src/components/Post/Meta.js` renders the post header.

## Requirements
1. Reading time on posts.

## Acceptance criteria
1. AC-1: Each post header shows “N min read”. Check: `grep -n 'min read' src/components/Post/Meta.js`
2. AC-2: Lint passes on changed files. Check: `npx eslint src/components/Post/Meta.js`

## Out of scope
Redesigning the header.

## Assumptions
- Average reading speed is 200 words per minute: common default.
