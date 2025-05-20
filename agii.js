const express = require('express');
const router = express.Router();
const { runQuery } = require('../graphService');

// GET /api/dijkstra  API
/**Тодорхой Бүтээгдэхүүний хувьд Нийлүүлэгчээс Хэрэглэгч хүртэлх хамгийн богино
нийлүүлэлтийн гинжин хэлхээний замыг олох. Тоо хэмжээнд тулгуурлан хамгийн богино
замыг илэрхийлэх зангилаануудын жагсаалт харуулах (жишээ нь, Нийлүүлэгч →
Бүтээгдэхүүн → Захиалга → Хэрэглэгч) */
router.get('/', async (req, res) => {
  // 1. Neo4j-ийн in-memory граф үүсгэх (Dijkstra-д зориулсан граф)
  const createGraph = `
    CALL gds.graph.project(
      'supplyChainGraph', -- графын нэр
      ['Supplier', 'Product', 'Order', 'Customer'], -- оролцогч node-н төрлүүд
      {
        SUPPLIES: { type: 'SUPPLIES', orientation: 'UNDIRECTED' }, -- нийлүүлэгч → бүтээгдэхүүн
        ORDERS: { type: 'ORDERS', orientation: 'UNDIRECTED' },     -- захиалга → бүтээгдэхүүн
        PURCHASED: { type: 'PURCHASED', orientation: 'UNDIRECTED' } -- хэрэглэгч → захиалга
      }
    )
    YIELD graphName
  `;

  // 2. Dijkstra алгоритмаар хамгийн богино замыг олж авах query
  const dijkstraQuery = `
    MATCH 
      (source:Supplier {companyName: "Tokyo Traders"}),    
      (target:Customer {contactName: "Ana Trujillo"})      
    CALL gds.shortestPath.dijkstra.stream('supplyChainGraph', {
      sourceNode: id(source),                               
      targetNode: id(target),                              
      relationshipWeightProperty: null                      
    })
    YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path
    RETURN
      gds.util.asNode(sourceNode).companyName AS from,       
      gds.util.asNode(targetNode).contactName AS to,        
      totalCost                                               
  `;

  try {
    // Граф үүсгэх
    await runQuery(createGraph);

    // Богино замын үр дүнг авах
    const result = await runQuery(dijkstraQuery);

    // JSON хэлбэрт оруулах
    const data = result.map(record => ({
      from: record.get('from'),
      to: record.get('to'),
      totalCost: record.get('totalCost'),
    }));

    res.json(data);
  } catch (err) {
    // Алдаа гарвал JSON хэлбэрээр харуулах
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
s