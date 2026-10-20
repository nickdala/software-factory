# Related posts under each post

> Feature: Show a few related posts at the end of each post

Type: feature

## Context
`src/templates/post.js` renders a post. Tags come from each post's front matter.
`src/components/PostList.js` already renders a list of post links.

## Requirements
1. Under each post, list up to 3 other posts that share a tag, most shared tags first.
2. Reuse `PostList` for the list. Show nothing when no post shares a tag.

## Acceptance criteria
1. AC-1: A tagged post shows up to 3 related links. Check: `npm test -- related`
2. AC-2: A post with no shared tags shows no list. Check: `npm test -- related`
3. AC-3: Lint passes on changed files. Check: `npx eslint src/templates/post.js src/utils/related.js`

## Out of scope
Changing tags, or ranking by anything but shared tags.

## Assumptions
- 3 posts, as the approved intent assumed.
