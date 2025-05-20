const express = require('express');
const neo4j = require('neo4j-driver');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7887';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_ENCRYPTED = process.env.NEO4J_ENCRYPTED === 'true';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'northwind';

if (!NEO4J_PASSWORD) {
  console.error('Error: NEO4J_PASSWORD must be set in .env file');
  process.exit(1);
}

if (!NEO4J_URI) {
  console.error('Error: NEO4J_URI must be set in .env file');
  process.exit(1);
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  {
    encrypted: NEO4J_ENCRYPTED ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
    trust: 'TRUST_ALL_CERTIFICATES'
  }
);

async function testNeo4jConnection() {
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    await session.run('RETURN 1');
    console.log('Neo4j connection successful!');
  } catch (error) {
    console.error('Failed to connect to Neo4j: ', error.message);
    process.exit(1);
  } finally {
    await session.close();
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the simple express API with Neo4J' });
});

app.get('/api/neo4j-test', async (req, res) => {
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run('RETURN "Neo4j connection successful" as message');
    res.json({ message: result.records[0].get('message') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/products-by-category', async (req, res) => {
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run(`
      MATCH (p:Product)-[PART_OF]->(c:Category)
      RETURN p.productName AS productName, c.categoryName AS categoryName
      LIMIT 10
    `);
    const records = result.records.map(record => ({
      productName: record.get('productName'),
      categoryName: record.get('categoryName')
    }));
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/*
CALL gds.graph.project('customerOrderGraph', ['Customer', 'Order'], 'PURCHASED');
*/


app.get('/api/pagerank', async (req, res) => {
  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    // await session.run(`
    const result = await session.run(`
      CALL gds.pageRank.stream('customerOrderGraph')
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      WHERE node:Customer
      RETURN node.companyName AS customer, score
      ORDER BY score DESC
    `);

    const records = result.records.map(record => ({
      customer: record.get('customer'),
      score: record.get('score')
    }));

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/*
CALL gds.graph.project(
'customerProductGraph',
['Customer', 'Order', 'Product'],
['PURCHASED', 'ORDERS']
);
*/

app.get('/api/louvain', async (req, res) => {
  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    const result = await session.run(`
      CALL gds.louvain.stream('customerProductGraph')
      YIELD nodeId, communityId
      WITH gds.util.asNode(nodeId) AS node, communityId
      WHERE node:Customer
      RETURN node.companyName AS customer, communityId
      ORDER BY communityId DESC
    `);

    const records = result.records.map(record => ({
      customer: record.get('customer'),
      communityId: record.get('communityId')
    }));

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/*
CALL gds.graph.project('supplyChainGraph', ['Supplier', 'Product', 'Order', 'Customer'], ['SUPPLIES', 'PART_OF', 'PURCHASED'], {relationshipProperties: 'quantity'});
*/

app.get('/api/djikstra', async (req, res) => {
  const session = driver.session({ database: NEO4J_DATABASE });
// CALL gds.graph.project(
//         supply ChainGraph',
//         ['Supplier', 'Product', 'Order', 'Customer'],
//         ['SUPPLIES', 'CONTAINS', 'PLACED'],
//         { relationshipProperties: 'quantity' }

//         );
  try {
    const result = await session.run(`
    MATCH (source:Supplier {companyName: 'Exotic Liquids'}),
      (target:Customer {companyName: 'Vins et alcools Chevalier'})
CALL gds.shortestPath.dijkstra.stream('supplyChainGraph', {
  sourceNode: id(source),
  targetNode: id(target),
  relationshipWeightProperty: 'quantity'
})
YIELD path
RETURN [node IN nodes(path) | node.companyName] AS path;
                            
  `);

    const records = result.records.map(record => ({
      customer: record.get('customer'),
      communityId: record.get('communityId')
    }));

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});



testNeo4jConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
