// Lets the editor save big files (preview clips, the showreel).
//
// The editor saves through GitHub's GraphQL API, which drops requests much
// over about 10 MB (the browser only says "Load failed"). This catches those
// big saves and makes the same commit through GitHub's REST API instead,
// which takes files up to 100 MB, then answers the editor as GraphQL would.
// Small saves are left alone. Load this before the editor script.
(() => {
  const GRAPHQL = 'https://api.github.com/graphql';
  const BIG = 8 * 1024 * 1024; // request size, in characters
  const realFetch = window.fetch.bind(window);

  window.fetch = async (resource, init) => {
    const body = init?.body;
    if (resource === GRAPHQL && typeof body === 'string' && body.length > BIG && body.includes('createCommitOnBranch')) {
      try {
        return json({ data: { createCommitOnBranch: { commit: await commitViaRest(JSON.parse(body), new Headers(init.headers)) } } });
      } catch (error) {
        return json({ errors: [{ message: error.message }] });
      }
    }
    return realFetch(resource, init);
  };

  const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  async function commitViaRest({ query, variables: { input } }, headers) {
    const auth = headers.get('Authorization');
    const api = `https://api.github.com/repos/${input.branch.repositoryNameWithOwner}/git`;
    const branch = encodeURIComponent(input.branch.branchName);
    const gh = async (path, method = 'GET', data) => {
      const res = await realFetch(`${api}/${path}`, {
        method,
        cache: 'no-cache',
        headers: { Authorization: auth, Accept: 'application/vnd.github+json', ...(data && { 'Content-Type': 'application/json' }) },
        body: data && JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`GitHub: ${out.message ?? res.status}`);
      return out;
    };

    const head = (await gh(`ref/heads/${branch}`)).object.sha;
    if (input.expectedHeadOid && head !== input.expectedHeadOid) {
      throw new Error('The site changed while you were editing. Reload the editor and save again.');
    }
    const { tree } = await gh(`commits/${head}`);

    // One upload per file, one at a time so a big file has the connection to itself.
    const blobs = {};
    for (const { path, contents } of input.fileChanges.additions ?? []) {
      blobs[path] = (await gh('blobs', 'POST', { content: contents, encoding: 'base64' })).sha;
    }
    const entries = [
      ...Object.entries(blobs).map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })),
      ...(input.fileChanges.deletions ?? []).map(({ path }) => ({ path, mode: '100644', type: 'blob', sha: null })),
    ];
    const newTree = await gh('trees', 'POST', { base_tree: tree.sha, tree: entries });
    const message = [input.message.headline, input.message.body].filter(Boolean).join('\n\n');
    const commit = await gh('commits', 'POST', { message, tree: newTree.sha, parents: [head] });
    await gh(`refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false });

    // The editor asks for some files' new IDs as `file_N: file(path: "...") { oid }`.
    const result = { oid: commit.sha, committedDate: commit.committer.date };
    for (const [, alias, path] of query.matchAll(/(file_\d+): file\(path: ("(?:[^"\\]|\\.)*")\)/g)) {
      const sha = blobs[JSON.parse(path)];
      if (sha) result[alias] = { oid: sha };
    }
    return result;
  }
})();
