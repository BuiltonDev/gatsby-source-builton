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

exports.sourceNodes = async (
  { actions, createContentDigest },
  { api_key, endpoint },
) => {

  const builton = new Builton({
    apiKey: api_key,
    endpoint: endpoint || 'https://api.builton.dev',
  });

  const { createNode } = actions;
  const productIterator = getAllProducts();
  for await (const product of productIterator) {
    product._sub_products___NODE = [];
    if (product._sub_products) {
      product._sub_products.forEach(subProduct => {
        subProduct.id = subProduct._id.$oid;
        subProduct.parents___NODE = subProduct.parents.map(p => p.id = p.$oid);
        createProductNode(createContentDigest, createNode)(subProduct);
        product._sub_products___NODE.push(subProduct.id);
      });
    }
    createProductNode(createContentDigest, createNode)(product);
  }

  async function* getAllProducts() {
    const size = 100;
    let productPage = await builton.products.get({
      size,
      urlParams: {
        expand: '_sub_products.image,image',
        sort: '-created',
        type: 'main',
      },
    });
    for (const product of productPage.current) {
      yield product;
    }
    const nbPage = Math.floor(productPage.paginationTotal / size);
    let currentPage = 0;
    while (currentPage <= nbPage) {
      await productPage.next();
      currentPage += 1;
      for (const product of productPage.current) {
        yield product;
      }
    }
  }
}



exports.onCreateNode = async ({
  node,
  actions,
  store,
  cache,
  createNodeId,
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
    } catch (e) {
      console.error(`gatsby-source-builton: Error fetching image`, e);
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
        console.error('gatsby-source-builton: Error fetching media', e);
      }
    });
    const mediaNodes = await Promise.all(mediaPromises);
    node.media___NODE = Array.from(mediaNodes, m => m.id);
  }
}