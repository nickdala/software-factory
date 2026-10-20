# Plan: Related posts under each post

## Approach
Add a small pure helper that picks related posts by shared tags, test it, then
call it from the post template and render the result with the existing `PostList`.

## Files
- `src/utils/related.js`: add. `relatedPosts(post, allPosts, limit = 3)`.
- `src/utils/related.test.js`: add. Tests for ranking, the limit and no matches.
- `src/templates/post.js`: change. Render `PostList` under the body when the helper returns posts.

## Steps
1. Test that a post with shared tags gets up to 3 of them, most shared first. Write
   `relatedPosts` until it passes: skip the post itself, count shared tags, sort by
   count then date, take `limit`.
2. Test that a post with no shared tags gets an empty list, and make it pass.
3. Call `relatedPosts` in `post.js` and render `PostList` only for a non-empty result.
4. Run the tests and lint the changed files.

## Seams
- `relatedPosts(post, allPosts, limit)`: catches ranking, the limit and the empty
  case. It misses the template wiring, which step 3 checks by eye in the dev server.

## Verification
1. AC-1: `npm test -- related` passes the "up to 3, most shared first" test.
2. AC-2: `npm test -- related` passes the "no shared tags" test.
3. AC-3: `npx eslint src/templates/post.js src/utils/related.js` prints nothing.

## Risks
- Posts with many tags in common tie: the date breaks the tie, so the order is stable.
