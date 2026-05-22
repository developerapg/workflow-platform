(METADATA)
1. Al crearse una entidad obligatoriamente debe especificarse un atributo como business key (con tipo de datos adecuado, nada business key en campos tipo fecha, jsonb, boolean, decimales, etc).

2. Hace falta crear un atributo de relación en la entidad de la izquierda (padre) que represente la navegación hacia la entidad de la derecha (hija).

(DISEÑO UX)

1. EL sidebar de la izquierda debe ser colapsable.

2. Las cards en el listado de entities y formas deberían tener un icono de borrado rápido.S

3. No hay acción de borrado cuando entras al detalle del formulario (En el detalle de la entidad si lo hay).

4. En el diseñador de formularios cuando se cuente con el atributo de navegación entre entidades, desde ese atributo es donde se debe desplegar el arbol de navegación para acceder a los atributos de la entidad hija.

5. En el diseñador de formularios el atributo de navegación puede ser arrastrado al formulario como un campo. Si el atributo representa una relación 1:N entonces el campo es de tipo combo o tipo search y debe obligatoriamente tener una propiedad displayAttribute para saber que valor renderizar. Si la relación es 1:N entonces el campo es de tipo tabla y debe permitir configurar las columnas a mostrar.





