# Tags in the RSS feed

> Feature: Tags in the RSS feed

## Context
`src/components/Post/Meta.js` renders the post header.

## Requirements
1. Tags in the RSS feed.

## Acceptance criteria
1. AC-1: Each feed item has <category> elements. Check: `grep -c '<category>' dist/rss.xml`

## Out of scope
Redesigning the header.

## Assumptions
- Average reading speed is 200 words per minute: common default.
