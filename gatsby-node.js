const Builton = require('@builton/node-sdk');
const { createRemoteFileNode } = require('gatsby-source-filesystem');

const nodeType = 'BuiltOnProduct';

const createProductNode = (createContentDigest, createNode) => (product) => {
  const nodeMeta = {
    id: product.id,
    internal: {
      type: nodeType,
      content: JSON.stringify(product),
      contentDigest: createContentDigest(product),
    }
  };

  const node = Object.assign({}, product, nodeMeta);
  createNode(node);
}

async function* getAllProducts(builton) {
  const size = 100;
  let productPage = await builton.products.get({
    size,
    urlParams: {
      expand: '_sub_products.image,image',
      sort: '-created',
      type: 'main',
    },
  });
  const nbPage = Math.floor(productPage.paginationTotal / size);
  let currentPage = 0;
  while (currentPage <= nbPage) {
    currentPage += 1;
    for (const product of productPage.current) {
      yield product;
    }
    await productPage.next();
  }
}

exports.sourceNodes = async (
  { actions, createContentDigest },
  { api_key, endpoint },
) => {

  const builton = new Builton({
    apiKey: api_key,
    endpoint: endpoint || 'https://api.builton.dev',
  });

  const { createNode } = actions;
  const productIterator = getAllProducts(builton);
  for await (const product of productIterator) {
    product._sub_products___NODE = [];
    if (product._sub_products) {
      product._sub_products.forEach(subProduct => {
        subProduct.id = subProduct._id.$oid;
        subProduct.parents___NODE = subProduct.parents.map(p => p.id = p.$oid);
        delete subProduct.parents;
        createProductNode(createContentDigest, createNode)(subProduct);
        product._sub_products___NODE.push(subProduct.id);
      });
    }
    delete product._sub_products;
    createProductNode(createContentDigest, createNode)(product);
  }
}


exports.onCreateNode = async ({
  node,
  actions,
  store,
  cache,
  createNodeId,
  reporter,
}) => {
  const { createNode } = actions;

  if (node.internal.type === nodeType && node.image && node.image.public && node.image.public_url) {
    try {
      const image = await createRemoteFileNode({
        url: node.image.public_url,
        store,
        cache,
        createNode,
        createNodeId
      });
      node.image___NODE = image.id;
      delete node.image;
    } catch (e) {
      reporter.panicOnBuild(e);
      return;
    }
  }

  if (node.internal.type === nodeType && node.media) {
    const mediaPromises = [];
    node.media.forEach((media) => {
      try {
        const promise = createRemoteFileNode({
          url: media.url,
          store,
          cache,
          createNode,
          createNodeId
        });
        mediaPromises.push(promise);
      } catch (e) {
        reporter.panicOnBuild(e);
        return;
      }
    });
    const mediaNodes = await Promise.all(mediaPromises);
    node.media___NODE = Array.from(mediaNodes, m => m.id);
    delete node.media;
  }
}

exports.createSchemaCustomization = ({ actions: { createTypes } }) => {
  createTypes(`
    type BuiltOnProduct implements Node {
      _sub_products: [BuiltOnProduct]
      image: File
      media: [File]
    }
  `)
}

// This allows having a fallback value when the field doesn't exist.
const customResolveFallback = (fallbackValue) => (source, args, context, info) => {
  const key = info.path.key;
  if (!source[key]) {
    return info.originalResolver(
      {
        ...source,
        [key]: fallbackValue
      },
      args,
      context,
      info
    )
  } else {
    return info.originalResolver(source, args, context, info)
  }
};

exports.createResolvers = ({ createResolvers }) => {
  createResolvers({
    BuiltOnProduct: {
      _sub_products: {
        resolve: customResolveFallback([]),
      },
      media: {
        resolve: customResolveFallback([]),
      },
      image: {
        resolve: customResolveFallback(null),
      },
    },
  })
}
