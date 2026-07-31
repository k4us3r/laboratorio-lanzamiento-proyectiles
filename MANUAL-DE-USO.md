# Manual sencillo de ProyectilLab

## ¿Para qué sirve?

ProyectilLab ayuda a resolver y simular ejercicios básicos de movimiento de proyectiles. Puede utilizarse para:

- lanzamiento vertical hacia arriba o hacia abajo;
- lanzamiento horizontal desde una altura;
- lanzamiento parabólico con velocidad y ángulo;
- calcular posiciones, velocidades, altura máxima, tiempo de vuelo, alcance e impacto;
- resolver varios incisos del mismo ejercicio en una sola operación.

El simulador utiliza gravedad constante y no considera resistencia del aire ni viento.

## Cómo resolver un ejercicio

### 1. Seleccione el tipo de lanzamiento

Elija la opción que corresponda:

- **Vertical:** el objeto solamente sube o baja. También seleccione la dirección.
- **Horizontal:** el objeto sale horizontalmente desde cierta altura.
- **Parabólico:** el objeto se lanza formando un ángulo.

### 2. Ingrese los datos iniciales

Escriba únicamente los valores proporcionados por el problema:

- **Velocidad inicial, v₀:** rapidez con la que se lanza el objeto.
- **Ángulo, θ:** inclinación del lanzamiento. No es necesario escribirlo en un lanzamiento vertical u horizontal.
- **Posición inicial, x₀:** normalmente puede dejarse en `0 m`.
- **Altura inicial, y₀:** altura desde la que comienza el movimiento.
- **v₀x y v₀y:** se utilizan solamente cuando el ejercicio proporciona directamente las componentes de la velocidad.
- **Gravedad, g:** normalmente se utiliza `9.81 m/s²`.

Los campos que el ejercicio no proporcione pueden dejarse vacíos.

## 3. Indique dónde termina el movimiento

Esta sección define el impacto y el final de la animación.

- **Impacta en el suelo:** utilice esta opción cuando el objeto termina en `y = 0`.
- **Impacta a una altura determinada:** escriba la altura real del punto de impacto.
- **Misma altura de lanzamiento:** utilícela cuando el objeto termina al mismo nivel desde el que salió.
- **Termina después de un tiempo:** úsela solamente cuando el problema indique el tiempo final.
- **Distancia horizontal determinada:** utilícela cuando se conozca dónde impacta horizontalmente.
- **Punto final no definido:** permite hacer consultas, pero no calcular el tiempo total ni la velocidad de impacto.

> Importante: un tiempo solicitado, por ejemplo “a los 3 segundos”, no es el tiempo final. Debe agregarse como una pregunta.

## 4. Agregue las preguntas del ejercicio

En **Nueva pregunta**, seleccione lo que pide cada inciso y presione **Agregar pregunta**.

Ejemplos:

- Hmax — altura máxima;
- posición y velocidad en un tiempo;
- tiempo cuando alcanza una altura;
- tiempo total de vuelo;
- velocidad de impacto;
- Rmax o Dmax.

Algunas preguntas muestran un campo propio:

- las consultas temporales solicitan un **tiempo de consulta**;
- las consultas de altura solicitan una **altura de consulta**;
- las consultas horizontales solicitan una **posición o desplazamiento**;
- las consultas de velocidad solicitan la **velocidad deseada**.

Puede agregar varios tiempos o repetir una pregunta con valores diferentes. Para eliminar un inciso, presione **Eliminar** en su tarjeta.

## 5. Resuelva el ejercicio

Cuando todos los datos necesarios estén completos, se habilitará **Resolver ejercicio**.

El sistema mostrará los incisos en orden. Cada procedimiento incluye:

1. datos utilizados;
2. fórmula;
3. sustitución;
4. operación;
5. resultado.

Si una altura se alcanza al subir y al bajar, aparecerán los dos tiempos. Las soluciones posteriores al impacto se descartan porque no pertenecen al movimiento físico.

## 6. Use la simulación

Después de resolver, presione **Simular ejercicio**.

Puede utilizar:

- **Iniciar:** comienza la animación;
- **Pausar/Reanudar:** detiene o continúa el movimiento;
- **Reiniciar:** vuelve al lanzamiento;
- **Velocidad de reproducción:** cambia la rapidez de la animación;
- **Mostrar vectores:** presenta las componentes de la velocidad y la gravedad.

En **Eventos del ejercicio** puede ir directamente al lanzamiento, la altura máxima, cada consulta y el impacto.

La telemetría muestra el tiempo actual, posición, velocidad y rapidez del proyectil.

## Ejemplo completo

**Problema:** un objeto se lanza verticalmente hacia arriba desde un edificio de `60 m`, con velocidad inicial de `20 m/s`. Se pide altura máxima, estado a los `3 s`, cuándo está a `70 m`, tiempo de vuelo y velocidad de impacto.

### Datos iniciales

- Tipo: **Vertical**.
- Dirección: **Hacia arriba**.
- v₀: `20 m/s`.
- x₀: `0 m`.
- y₀: `60 m`.
- g: `9.81 m/s²`.

### Condición final

- Seleccione **Impacta en el suelo**.

### Preguntas

Agregue:

1. **Hmax — Altura máxima**.
2. **Posición y velocidad en un tiempo**, con `t = 3 s`.
3. **Tiempo cuando alcanza una altura**, con `y = 70 m`.
4. **Tiempo total de vuelo**.
5. **Velocidad de impacto**.

El tiempo de `3 s` y la altura de `70 m` se escriben dentro de sus preguntas. No modifican el impacto en el suelo.

## Mensajes frecuentes

- **Faltan datos iniciales:** revise v₀, θ o las componentes de la velocidad.
- **Necesita una condición final:** defina dónde termina el movimiento para calcular impacto, tiempo total, Rmax o Dmax.
- **No alcanza la altura solicitada:** la altura supera Hmax o queda fuera de la trayectoria física.
- **Ya impactó antes del tiempo solicitado:** la consulta ocurre después del final del movimiento.
- **v₀x = 0:** en un lanzamiento vertical no puede alcanzarse otra coordenada horizontal.

## Simulación libre

La pestaña **Simulación libre** permite experimentar sin crear preguntas. Ingrese velocidad, ángulo, posición inicial, altura final y gravedad; después presione **Preparar simulación**.

## Recomendación final

Lea el ejercicio en este orden:

1. identifique el tipo de lanzamiento;
2. separe los datos iniciales;
3. determine dónde ocurre el impacto;
4. convierta cada inciso en una pregunta;
5. verifique las unidades antes de resolver.
