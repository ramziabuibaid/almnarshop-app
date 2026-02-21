SELECT 
  qd.product_id, 
  SUM(qd.quantity) as reserved_quantity
FROM quotations q
JOIN quotation_details qd ON q.quotation_id = qd.quotation_id
WHERE q.status = 'مدفوع كلي أو جزئي تم الحجز'
GROUP BY qd.product_id;
