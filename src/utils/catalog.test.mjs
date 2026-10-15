import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, exportCsv } from './catalogCsv.js';
import { reconcileCart, addToCart } from './cart.js';

test('CSV conserva variantes, comillas, saltos de línea y visibilidad al exportar e importar',()=>{
  const product={id:'1',nombre:'Proteína "especial"',categoria:'Proteínas',marca:'Marca',precio:10.5,stock:5,
    visible:true,disponible:false,destacado:true,descripcion:'Una línea;\notra línea',imagen:'',
    tamanos:['1kg','2kg'],sabores:['Chocolate'],versiones:[],colores:[],materiales:[],preciosPorTamano:{'1kg':5}};
  assert.deepEqual(parseCsv(exportCsv([product])),[product]);
  assert.throws(()=>parseCsv('nombre;categoria;precio;stock\nA;B;;5'));
  assert.throws(()=>parseCsv('nombre;categoria;precio;stock;visible\nA;B;5;1;quizás'));
});

test('Carrito elimina ocultos, respeta disponibilidad y actualiza precios y stock',()=>{
  const product={id:'1',nombre:'Proteína',precio:100,stock:5,imagen:'',disponible:true,
    tamanos:['1kg'],sabores:['Chocolate'],preciosPorTamano:{'1kg':80},variantDetail:{'tamaño':'1kg',sabor:'Chocolate'}};
  const items=addToCart([],product,3,5);
  assert.deepEqual(reconcileCart(items,[]),[]);
  assert.deepEqual(reconcileCart(items,[{...product,disponible:false}]),[]);
  assert.deepEqual(reconcileCart(items,[{...product,sabores:['Vainilla']}]),[]);
  const current=reconcileCart(items,[{...product,stock:2,preciosPorTamano:{'1kg':90}}]);
  assert.equal(current[0].qty,2); assert.equal(current[0].precio,90);
});
