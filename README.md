# gatsby-source-builton

This is a source plugin for using your data from [BuiltOn](https://builton.dev) in a Gatsby website.

## Installation

```
# Install the plugin
yarn add @builton/gatsby-source-builton
```

in `gatsby-config.js`

```js
// In your gatsby-config.js
plugins: [
  {
    resolve: `@builton/gatsby-source-builton`,
    options: {
      api_key: '...'
    },
  },
],
```

## How to query

```
query {
  allBuiltOnProduct {
    edges {
      node {
        id,
        name,
        description,
        [...]
      }
    }
  }
}
```

## Create one page per product

```javascript
// ./gatsby-node.js
const path = require(`path`);

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;
  const result = await graphql(`
    query {
      allBuiltOnProduct {
        edges {
          node {
            id
          }
        }
      }
    }
  `);
  result.data.allBuiltOnProduct.edges.forEach(({ node }) => {
    createPage({
     path: node.id,
     component: path.resolve(`./src/templates/product.js`),
      context: {
        id: node.id,
      },
    })
  });
};
```

```javascript
// ./src/templates/product.js
import React from "react";
import { graphql } from "gatsby";
import Layout from "../components/layout";

export default ({ data }) => {
  const product = data.builtOnProduct;
  return (
    <Layout>
      <div>
        <h1>{product.name}</h1>
      </div>
    </Layout>
  );
};

export const query = graphql`
  query($id: String!) {
    builtOnProduct(id: { eq: $id }) {
      name
    }
  }
`;

```
