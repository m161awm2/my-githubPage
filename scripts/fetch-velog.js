const fs = require("fs/promises");
const path = require("path");

const VELOG_USERNAME = "m161awm";
const VELOG_GRAPHQL_URL = "https://v2.velog.io/graphql";
const VELOG_PROFILE_URL = `https://velog.io/@${VELOG_USERNAME}`;
const OUTPUT_PATH = path.join(__dirname, "..", "posts.json");
const PROFILE_OUTPUT_PATH = path.join(__dirname, "..", "velog-profile.json");
const SERIES_OUTPUT_PATH = path.join(__dirname, "..", "series.json");
const PAGE_SIZE = 50;

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength = 220) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function postUrl(slug) {
  return `${VELOG_PROFILE_URL}/${encodeURIComponent(slug)}`;
}

async function velogQuery(query, variables = {}) {
  const response = await fetch(VELOG_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "m161awm2-test1234-github-pages/1.0"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Failed to query Velog GraphQL: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(`Velog GraphQL error: ${result.errors.map((error) => error.message).join(", ")}`);
  }
  return result.data;
}

async function fetchVelogPosts() {
  const query = `query Posts($username: String, $cursor: ID, $limit: Int) {
    posts(username: $username, cursor: $cursor, limit: $limit) {
      id title url_slug thumbnail short_description released_at likes
    }
  }`;
  const posts = [];
  let cursor = null;

  while (true) {
    const data = await velogQuery(query, { username: VELOG_USERNAME, cursor, limit: PAGE_SIZE });
    const page = data?.posts || [];
    posts.push(...page);
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].id;
  }

  return posts.map((post) => ({
    title: cleanText(post.title),
    link: postUrl(post.url_slug),
    pubDate: post.released_at ? new Date(post.released_at).toUTCString() : "",
    description: truncateText(post.short_description),
    thumbnail: post.thumbnail || "",
    likes: Number(post.likes) || 0
  }));
}

async function fetchVelogSeries() {
  const data = await velogQuery(`query Series($username: String) {
    user(username: $username) {
      series_list {
        name url_slug thumbnail
        series_posts { index post { title url_slug tags thumbnail } }
      }
    }
  }`, { username: VELOG_USERNAME });

  return (data?.user?.series_list || []).map((series) => ({
    name: cleanText(series.name),
    url: `${VELOG_PROFILE_URL}/series/${encodeURIComponent(series.url_slug)}`,
    thumbnail: series.thumbnail || "",
    posts: (series.series_posts || [])
      .filter((item) => item?.post)
      .sort((a, b) => a.index - b.index)
      .map(({ post }) => ({
        title: cleanText(post.title),
        link: postUrl(post.url_slug),
        tags: post.tags || [],
        thumbnail: post.thumbnail || ""
      }))
  }));
}

async function fetchVelogTitle() {
  try {
    const data = await velogQuery(`query Config($username: String) {
      velog_config(username: $username) { title }
    }`, { username: VELOG_USERNAME });
    return cleanText(data?.velog_config?.title);
  } catch {
    return "";
  }
}

function buildVelogProfile(title, posts) {
  const latestPost = posts[0] || {};
  const totalLikes = posts.reduce((sum, post) => sum + (Number(post.likes) || 0), 0);

  return {
    username: VELOG_USERNAME,
    title: title || `${VELOG_USERNAME}.log`,
    description: "Velog에 기록한 개발 학습 로그입니다.",
    url: VELOG_PROFILE_URL,
    postCount: posts.length,
    totalLikes,
    latestPost: {
      title: latestPost.title || "",
      link: latestPost.link || VELOG_PROFILE_URL,
      pubDate: latestPost.pubDate || ""
    },
    updatedAt: latestPost.pubDate || ""
  };
}

async function main() {
  const [posts, series, title] = await Promise.all([fetchVelogPosts(), fetchVelogSeries(), fetchVelogTitle()]);
  const profile = buildVelogProfile(title, posts);

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
  await fs.writeFile(PROFILE_OUTPUT_PATH, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await fs.writeFile(SERIES_OUTPUT_PATH, `${JSON.stringify(series, null, 2)}\n`, "utf8");

  console.log(`Wrote ${posts.length} Velog posts to ${OUTPUT_PATH}`);
  console.log(`Wrote Velog profile to ${PROFILE_OUTPUT_PATH}`);
  console.log(`Wrote ${series.length} Velog series to ${SERIES_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
