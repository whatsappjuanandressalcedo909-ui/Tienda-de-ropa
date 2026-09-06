# 📦 Sistema de Gestión de Inventario y Ventas (PWA)

Una aplicación web progresiva (PWA) moderna y rápida, diseñada para la gestión integral de inventario, ventas, clientes y créditos (cuentas por cobrar) para tiendas físicas o en línea, con sincronización en tiempo real en la nube.

## ✨ Características Principales

### 📦 Gestión de Inventario
- **Control de Productos:** Registro detallado de productos con Nombre, SKU, Categoría, Talla, Color, Precio y Stock.
- **Generación de SKU Inteligente:** Botón para autogenerar códigos SKU alfanuméricos únicos de 8 caracteres, o ingreso manual con conversión automática a mayúsculas.
- **Alertas de Stock:** Indicadores visuales para productos con bajo stock o agotados.
- **Filtros y Búsqueda:** Búsqueda rápida por nombre o SKU, y ordenamiento por nombre, precio, cantidad de stock o los agregados recientemente.

### 🛒 Módulo de Ventas (Punto de Venta)
- **Carrito de Compras:** Interfaz intuitiva para añadir productos al carrito de ventas.
- **Validación de Stock:** Evita vender más unidades de las disponibles en el inventario.
- **Métodos de Pago Flexibles:**
  - Pago de Contado (Pago Total).
  - Pago a Crédito / Cuotas (Generación de plan de pagos).
- **Registro de Clientes:** Asocia las ventas a clientes nuevos o existentes.

### 💳 Cuentas por Cobrar (Créditos)
- **Gestión de Cuotas:** Panel dedicado para visualizar todas las ventas realizadas a crédito.
- **Registro de Pagos:** Permite abonar a cuotas específicas y calcular automáticamente el saldo restante.
- **Estados Visuales:** Indicadores de cuotas "Pendientes" y "Pagadas".

### 👥 Base de Datos de Clientes
- Registro automático de clientes al momento de realizar una venta.
- Historial de compras asociado a cada perfil de cliente.

### ⚙️ Ajustes y Personalización Avanzada
- **Gestión de Categorías:** Añadir o eliminar categorías de productos de forma dinámica.
- **Tallas Específicas por Categoría:** Posibilidad de asignar tablas de tallas únicas para cada categoría (ej. Tallas de Zapatos vs. Tallas de Camisas).
- **Monitor de Conexión en Tiempo Real:** Widget que comprueba y muestra el estado de la conexión con el servidor de base de datos cada 5 minutos (Estable, Interferencia, Desconectado).
- **Copias de Seguridad (Backup):** Exportación e importación manual de toda la base de datos (inventario, ventas, clientes, categorías y tallas) en formato JSON.
- **Reinicio del Sistema:** Opción segura para borrar la base de datos en caso de ser necesario.

## 🛠️ Aspectos Técnicos y Arquitectura

- **Sincronización en la Nube:** Base de datos NoSQL utilizando **Firebase Firestore** para mantener los datos actualizados en tiempo real en todos los dispositivos.
- **Modo PWA (Progressive Web App):** Instalable en dispositivos móviles (iOS/Android) y escritorio, ofreciendo una experiencia nativa.
- **Protección de Acceso:** Sistema de autenticación de administradores.
- **Tecnologías Core:** 
  - React 18 + Vite
  - TypeScript (Tipado estricto para mayor seguridad)
  - Tailwind CSS (Diseño adaptable, limpio y responsivo)
  - Framer Motion (Animaciones fluidas de interfaz)
  - Lucide React (Iconografía moderna)

## 🚀 Inicio Rápido (Desarrollo Local)

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre el navegador en `http://localhost:3000`

---
*Desarrollado para ofrecer un control de inventario profesional, rápido y sin complicaciones.*
