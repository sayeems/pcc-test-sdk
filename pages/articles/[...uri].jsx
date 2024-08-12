import {
  PantheonProvider,
  PCCConvenienceFunctions,
} from "@pantheon-systems/pcc-react-sdk";
import { NextSeo } from "next-seo";
import queryString from "query-string";
import ArticleView from "../../components/article-view";
import { PageGrid } from "../../components/grid";
import Layout from "../../components/layout";
import { Tags } from "../../components/tags";
import { pantheonAPIOptions } from "../api/pantheoncloud/[...command]";

export default function ArticlePage({ article, grant, recommendedArticles }) {
  const seoMetadata = getSeoMetadata(article);

  return (
    <PantheonProvider
      client={PCCConvenienceFunctions.buildPantheonClient({
        isClientSide: true,
        pccGrant: grant,
      })}
    >
      <Layout>
        <NextSeo
          title={seoMetadata.title}
          description={seoMetadata.description}
          openGraph={{
            type: "website",
            title: seoMetadata.title,
            description: seoMetadata.description,
            images: seoMetadata.images,
            article: {
              authors: seoMetadata.authors,
              tags: seoMetadata.tags,
              ...(seoMetadata.publishedTime && {
                publishedTime: seoMetadata.publishedTime,
              }),
            },
          }}
        />

        <div className="max-w-screen-lg mx-auto mt-16 prose text-black">
          <ArticleView article={article} />
          <Tags tags={article?.tags} />
          <section>
            <h3>Recommended Articles</h3>
            <PageGrid data={recommendedArticles} />
          </section>
        </div>
      </Layout>
    </PantheonProvider>
  );
}

export async function getServerSideProps({
  req: { cookies },
  query: { uri, publishingLevel, pccGrant, ...query },
}) {
  const slugOrId = uri[uri.length - 1];
  const grant = pccGrant || cookies["PCC-GRANT"] || null;

  const article = await PCCConvenienceFunctions.getArticleBySlugOrId(
    slugOrId,
    publishingLevel ? publishingLevel.toString().toUpperCase() : "PRODUCTION",
  );

  if (!article) {
    return {
      notFound: true,
    };
  }

  if (
    article.slug?.trim().length &&
    article.slug.toLowerCase() !== slugOrId?.trim().toLowerCase()
  ) {
    // If the article was accessed by the id rather than the slug - then redirect to the canonical
    // link (mostly for SEO purposes than anything else).
    return {
      redirect: {
        destination: queryString.stringifyUrl({
          url: pantheonAPIOptions.resolvePath(article),
          query: { publishingLevel, ...query },
        }),
        permanent: false,
      },
    };
  }

  return {
    props: {
      article,
      grant,
      recommendedArticles: await PCCConvenienceFunctions.getRecommendedArticles(
        article.id,
      ),
    },
  };
}

function isDateInputObject(v) {
  return v.msSinceEpoch != null;
}

export const getSeoMetadata = (article) => {
  const tags = article.tags && article.tags.length > 0 ? article.tags : [];
  let authors = [];
  let publishedTime = null;

  // Collecting data from metadata fields
  Object.entries(article.metadata || {}).forEach(([key, val]) => {
    if (key.toLowerCase().trim() === "author" && val) authors = [val];
    else if (key.toLowerCase().trim() === "date" && isDateInputObject(val))
      publishedTime = new Date(val.msSinceEpoch).toISOString();
  });

  const imageProperties = [
    article.metadata?.["Hero Image"],
    // Extend as needed
  ]
    .filter((url) => typeof url === "string")
    .map((url) => ({ url }));

  return {
    title: article.title,
    description: "Article hosted using Pantheon Content Cloud",
    tags,
    authors,
    publishedTime,
    images: imageProperties,
  };
};
