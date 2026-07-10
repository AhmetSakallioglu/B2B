import pg from "pg";

const SKUS = ["VSD2421", "VSD2721", "VSD3021", "VSD3321", "VSD3621"];

const CATEGORY_SLUG = "kitchen-cabinet";
const SUB_CATEGORY_SLUG = "wall-cabinet";
const HEIGHT_IN = 34.5;
const DEPTH_IN = 21;

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:5454@localhost:5432/cabinet_project",
});

function parseSku(sku) {
  const match = sku.match(/^VSD(\d{2})\d{2}$/);

  if (!match) {
    throw new Error(`Invalid SKU format: ${sku}`);
  }

  return {
    widthIn: Number.parseInt(match[1], 10),
    heightIn: HEIGHT_IN,
    depthIn: DEPTH_IN,
  };
}

function buildVariantSku(productSku, finishName, widthIn, heightIn, depthIn) {
  const colorCode = finishName
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return `${productSku}-${colorCode}-${widthIn}-${heightIn}-${depthIn}`;
}

function formatDescription(widthIn, depthIn) {
  return `${widthIn}"W x 34-1/2"H x ${depthIn}"D`;
}

function pseudoRandomPrice(sku, finishId) {
  let hash = 0;
  const key = `${sku}:${finishId}`;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return 249 + (hash % 351) + 0.99;
}

async function main() {
  const client = await pool.connect();

  try {
    const subCategory = await client.query(
      `
        SELECT sc.id
        FROM sub_categories sc
        JOIN categories c ON c.id = sc.category_id
        WHERE c.slug = $1 AND sc.slug = $2
      `,
      [CATEGORY_SLUG, SUB_CATEGORY_SLUG]
    );

    if (subCategory.rows.length === 0) {
      throw new Error("Kitchen Cabinet / Wall Cabinet category not found");
    }

    const subCategoryId = subCategory.rows[0].id;

    const finishes = await client.query(
      `
        SELECT id, name
        FROM door_finishes
        WHERE is_active = true
        ORDER BY sort_order ASC, name ASC
      `
    );

    if (finishes.rows.length === 0) {
      throw new Error("No active door finishes found");
    }

    await client.query("BEGIN");

    let createdProducts = 0;
    let skippedProducts = 0;
    let createdVariants = 0;
    let skippedVariants = 0;

    for (const sku of SKUS) {
      const { widthIn, heightIn, depthIn } = parseSku(sku);
      const productName = sku;
      const description = formatDescription(widthIn, depthIn);

      const existingProduct = await client.query(
        "SELECT id FROM products WHERE sku = $1",
        [sku]
      );

      let productId;

      if (existingProduct.rows.length > 0) {
        productId = existingProduct.rows[0].id;
        skippedProducts += 1;

        await client.query(
          `
            UPDATE products
            SET
              sub_category_id = $1,
              name = $2,
              description = $3
            WHERE id = $4
          `,
          [subCategoryId, productName, description, productId]
        );
      } else {
        const inserted = await client.query(
          `
            INSERT INTO products (sub_category_id, sku, name, description, image_url)
            VALUES ($1, $2, $3, $4, NULL)
            RETURNING id
          `,
          [subCategoryId, sku, productName, description]
        );

        productId = inserted.rows[0].id;
        createdProducts += 1;
      }

      for (const finish of finishes.rows) {
        const variantSku = buildVariantSku(
          sku,
          finish.name,
          widthIn,
          heightIn,
          depthIn
        );
        const price = pseudoRandomPrice(sku, finish.id);

        const duplicate = await client.query(
          `
            SELECT id
            FROM product_variants
            WHERE product_id = $1
              AND finish_id = $2
              AND width_in = $3
              AND height_in = $4
              AND depth_in = $5
          `,
          [productId, finish.id, widthIn, heightIn, depthIn]
        );

        if (duplicate.rows.length > 0) {
          skippedVariants += 1;
          continue;
        }

        await client.query(
          `
            INSERT INTO product_variants (
              product_id,
              finish_id,
              width_in,
              height_in,
              depth_in,
              stock_status,
              price,
              sku
            )
            VALUES ($1, $2, $3, $4, $5, 'in_stock', $6, $7)
          `,
          [productId, finish.id, widthIn, heightIn, depthIn, price, variantSku]
        );

        createdVariants += 1;
      }
    }

    await client.query("COMMIT");

    console.log("VSD cabinet bulk seed completed.");
    console.log(`Products created: ${createdProducts}, skipped: ${skippedProducts}`);
    console.log(`Variants created: ${createdVariants}, skipped: ${skippedVariants}`);
    console.log(`Finishes per product: ${finishes.rows.length}`);
    console.log(`Total SKUs processed: ${SKUS.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : String(error);
    console.error("VSD cabinet bulk seed failed:", message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
