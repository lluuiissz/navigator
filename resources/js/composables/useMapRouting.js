export function useMapRouting() {

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Calculate bearing (direction) between two points
  const calculateBearing = (lat1, lng1, lat2, lng2) => {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    const θ = Math.atan2(y, x)

    return ((θ * 180) / Math.PI + 360) % 360 // Normalize to 0-360
  }

  // Get direction from bearing
  const getDirection = (bearing) => {
    const directions = [
      { min: 0, max: 22.5, text: 'north', icon: '⬆️' },
      { min: 22.5, max: 67.5, text: 'northeast', icon: '↗️' },
      { min: 67.5, max: 112.5, text: 'east', icon: '➡️' },
      { min: 112.5, max: 157.5, text: 'southeast', icon: '↘️' },
      { min: 157.5, max: 202.5, text: 'south', icon: '⬇️' },
      { min: 202.5, max: 247.5, text: 'southwest', icon: '↙️' },
      { min: 247.5, max: 292.5, text: 'west', icon: '⬅️' },
      { min: 292.5, max: 337.5, text: 'northwest', icon: '↖️' },
      { min: 337.5, max: 360, text: 'north', icon: '⬆️' }
    ]

    for (const dir of directions) {
      if (bearing >= dir.min && bearing < dir.max) {
        return dir
      }
    }
    return directions[0]
  }

  // Calculate turn angle between three points
  const calculateTurnAngle = (p1, p2, p3) => {
    const bearing1 = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng)
    const bearing2 = calculateBearing(p2.lat, p2.lng, p3.lat, p3.lng)

    let angle = bearing2 - bearing1
    if (angle > 180) angle -= 360
    if (angle < -180) angle += 360

    return angle
  }

  // Get turn instruction
  const getTurnInstruction = (angle) => {
    if (Math.abs(angle) < 20) return { text: 'Continue straight', icon: '⬆️' }
    if (angle > 20 && angle < 70) return { text: 'Turn slight right', icon: '↗️' }
    if (angle >= 70 && angle < 120) return { text: 'Turn right', icon: '➡️' }
    if (angle >= 120) return { text: 'Turn sharp right', icon: '↪️' }
    if (angle < -20 && angle > -70) return { text: 'Turn slight left', icon: '↖️' }
    if (angle <= -70 && angle > -120) return { text: 'Turn left', icon: '⬅️' }
    if (angle <= -120) return { text: 'Turn sharp left', icon: '↩️' }
    return { text: 'Continue', icon: '⬆️' }
  }

  // Find nearest point on LineString
  const getNearestPointOnLine = (point, coordinates) => {
    let nearestIndex = 0
    let minDist = Infinity

    coordinates.forEach((coord, idx) => {
      const dist = calculateDistance(point.lat, point.lng, coord[1], coord[0])
      if (dist < minDist) {
        minDist = dist
        nearestIndex = idx
      }
    })

    return { index: nearestIndex, coord: coordinates[nearestIndex], distance: minDist }
  }

  // Find clicked LineString feature
  const findClickedLineString = (clickPoint, features, threshold = 30) => {
    let closestFeature = null
    let closestPoint = null
    let minDist = Infinity

    features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates
        const nearest = getNearestPointOnLine(clickPoint, coords)

        if (nearest.distance < minDist) {
          minDist = nearest.distance
          closestFeature = feature
          closestPoint = nearest
        }
      }
    })

    return minDist <= threshold ? { feature: closestFeature, point: closestPoint } : null
  }

  // Get public route from OSRM
  const getPublicRoute = async (start, end, transportMode) => {
    try {
      const profile = transportMode === 'driving' ? 'driving' : transportMode === 'riding' ? 'cycling' : 'walking'
      const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      const response = await fetch(url)
      const data = await response.json()

      if (data.code === 'Ok' && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates
        return coords.map(([lng, lat]) => ({ lat, lng }))
      }
    } catch (err) {
      console.error('OSRM routing error:', err)
    }
    return null
  }

  // Build campus graph from GeoJSON features
  const buildCampusGraph = (geojsonFeatures) => {
    const graph = new Map()
    const nodeMap = new Map()

    const getNodeId = (lat, lng) => {
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
      if (!nodeMap.has(key)) {
        const nodeId = `node_${nodeMap.size}`
        nodeMap.set(key, nodeId)
        graph.set(nodeId, {
          id: nodeId,
          lat,
          lng,
          neighbors: []
        })
      }
      return nodeMap.get(key)
    }

    geojsonFeatures.forEach((feature) => {
      if (feature.geometry.type !== 'LineString') return

      const coords = feature.geometry.coordinates
      let prevNodeId = null

      coords.forEach(([lng, lat]) => {
        const nodeId = getNodeId(lat, lng)
        const currentNode = graph.get(nodeId)

        if (prevNodeId) {
          const prevNode = graph.get(prevNodeId)
          const distance = calculateDistance(prevNode.lat, prevNode.lng, lat, lng)

          if (!currentNode.neighbors.some(n => n.id === prevNodeId)) {
            currentNode.neighbors.push({ id: prevNodeId, cost: distance })
          }
          if (!prevNode.neighbors.some(n => n.id === nodeId)) {
            prevNode.neighbors.push({ id: nodeId, cost: distance })
          }
        }

        prevNodeId = nodeId
      })
    })

    console.log(`Built graph with ${graph.size} nodes`)
    return graph
  }

  // Find nearest node in graph
  const findNearestNode = (point, graph, maxDistance = 100) => {
    let nearestId = null
    let minDist = Infinity

    for (const [nodeId, node] of graph.entries()) {
      const dist = calculateDistance(point.lat, point.lng, node.lat, node.lng)
      if (dist < minDist && dist <= maxDistance) {
        minDist = dist
        nearestId = nodeId
      }
    }

    return nearestId
  }

  // Enhanced A* Pathfinding Algorithm with optimizations
  const findPathAStar = (startId, goalId, graph) => {
    if (!graph.has(startId) || !graph.has(goalId)) {
      console.warn('Start or goal node not in graph')
      return null
    }

    // Early exit if start and goal are the same
    if (startId === goalId) {
      const node = graph.get(startId)
      return [{ lat: node.lat, lng: node.lng }]
    }

    const closedSet = new Set()
    const cameFrom = new Map()
    const gScore = new Map()
    const fScore = new Map()

    // Priority queue using binary heap for better performance
    class PriorityQueue {
      constructor() {
        this.heap = []
      }

      push(item, priority) {
        this.heap.push({ item, priority })
        this.bubbleUp(this.heap.length - 1)
      }

      pop() {
        if (this.heap.length === 0) return null
        const result = this.heap[0].item
        const last = this.heap.pop()
        if (this.heap.length > 0) {
          this.heap[0] = last
          this.bubbleDown(0)
        }
        return result
      }

      bubbleUp(index) {
        while (index > 0) {
          const parentIndex = Math.floor((index - 1) / 2)
          if (this.heap[index].priority >= this.heap[parentIndex].priority) break
          ;[this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]]
          index = parentIndex
        }
      }

      bubbleDown(index) {
        while (true) {
          let smallest = index
          const left = 2 * index + 1
          const right = 2 * index + 2

          if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
            smallest = left
          }
          if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
            smallest = right
          }
          if (smallest === index) break
          ;[this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]]
          index = smallest
        }
      }

      isEmpty() {
        return this.heap.length === 0
      }
    }

    const openSet = new PriorityQueue()
    gScore.set(startId, 0)

    const startNode = graph.get(startId)
    const goalNode = graph.get(goalId)

    // Enhanced heuristic with slight underestimation for optimality
    const heuristic = (nodeA, nodeB) => {
      const dist = calculateDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng)
      return dist * 0.95 // Slight underestimation ensures optimality
    }

    fScore.set(startId, heuristic(startNode, goalNode))
    openSet.push(startId, fScore.get(startId))

    let iterations = 0
    const maxIterations = graph.size * 2 // Prevent infinite loops

    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++
      const currentId = openSet.pop()

      // Found the goal!
      if (currentId === goalId) {
        console.log(`✅ Path found in ${iterations} iterations`)
        return reconstructPath(cameFrom, currentId, graph)
      }

      // Skip if already processed
      if (closedSet.has(currentId)) continue
      closedSet.add(currentId)

      const currentNode = graph.get(currentId)
      if (!currentNode) continue

      const currentG = gScore.get(currentId) || Infinity

      // Process all neighbors
      for (const neighbor of currentNode.neighbors) {
        const neighborId = neighbor.id

        // Skip if already evaluated
        if (closedSet.has(neighborId)) continue

        const neighborNode = graph.get(neighborId)
        if (!neighborNode) continue

        // Calculate tentative g score
        const tentativeG = currentG + neighbor.cost

        // If this is a better path
        if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
          cameFrom.set(neighborId, currentId)
          gScore.set(neighborId, tentativeG)

          const f = tentativeG + heuristic(neighborNode, goalNode)
          fScore.set(neighborId, f)
          openSet.push(neighborId, f)
        }
      }
    }

    console.warn(`⚠️ No path found after ${iterations} iterations`)
    return null
  }

  // Reconstruct path from cameFrom map
  const reconstructPath = (cameFrom, currentId, graph) => {
    const path = []
    let current = currentId

    while (current) {
      const node = graph.get(current)
      path.unshift({ lat: node.lat, lng: node.lng })
      current = cameFrom.get(current)
    }

    return path
  }

  // Calculate total route distance
  const calculateRouteDistance = (route) => {
    let totalDistance = 0
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(
        route[i].lat, route[i].lng,
        route[i + 1].lat, route[i + 1].lng
      )
    }
    return totalDistance
  }

  // Find campus entrances
  const findCampusEntrances = (graph) => {
    const entrances = []
    for (const [nodeId, node] of graph.entries()) {
      entrances.push({
        id: nodeId,
        lat: node.lat,
        lng: node.lng,
        node: node
      })
    }
    return entrances
  }

  // Generate enhanced navigation instructions
  const generateEnhancedInstructions = (route, isPrivatePath) => {
    if (!route || route.length < 2) {
      return [{
        icon: '📍',
        text: 'You are at your destination',
        distance: '0 m'
      }]
    }

    const instructions = []
    let cumulativeDistance = 0
    const maxInstructions = 7

    // Start instruction with initial direction
    const initialBearing = calculateBearing(
      route[0].lat, route[0].lng,
      route[1].lat, route[1].lng
    )
    const initialDir = getDirection(initialBearing)

    instructions.push({
      icon: '🚶',
      text: `Start heading ${initialDir.text}`,
      distance: '0 m',
      bearing: initialBearing.toFixed(0) + '°'
    })

    // Calculate total route distance first
    let totalDistance = 0
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(
        route[i].lat, route[i].lng,
        route[i + 1].lat, route[i + 1].lng
      )
    }

    // Collect all significant turns
    const significantTurns = []
    cumulativeDistance = 0

    for (let i = 1; i < route.length - 1; i++) {
      const segmentDist = calculateDistance(
        route[i - 1].lat, route[i - 1].lng,
        route[i].lat, route[i].lng
      )
      cumulativeDistance += segmentDist

      const turnAngle = calculateTurnAngle(
        route[i - 1],
        route[i],
        route[i + 1]
      )

      // Only consider significant turns
      if (Math.abs(turnAngle) > 20) {
        const bearing = calculateBearing(
          route[i].lat, route[i].lng,
          route[i + 1].lat, route[i + 1].lng
        )

        significantTurns.push({
          index: i,
          angle: turnAngle,
          distance: cumulativeDistance,
          bearing: bearing
        })
      }
    }

    // Add campus entry/exit notification if hybrid route
    if (isPrivatePath && totalDistance > 100) {
      const midDistance = totalDistance / 2

      instructions.push({
        icon: '🏫',
        text: 'Enter campus grounds',
        distance: `${Math.round(midDistance)} m`
      })
    }

    // Select most important turns to fit within maxInstructions limit
    // Reserve 1 for start (already added) and 1 for arrival = 5 slots remaining
    const slotsAvailable = maxInstructions - 2 - (isPrivatePath ? 1 : 0)

    if (significantTurns.length > slotsAvailable) {
      // Sort by turn angle magnitude and select the most significant
      significantTurns.sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle))
      significantTurns.splice(slotsAvailable)
      // Re-sort by distance to maintain order
      significantTurns.sort((a, b) => a.distance - b.distance)
    }

    // Add selected turn instructions
    significantTurns.forEach(turn => {
      const turnInstr = getTurnInstruction(turn.angle)
      instructions.push({
        icon: turnInstr.icon,
        text: turnInstr.text,
        distance: `${Math.round(turn.distance)} m`,
        bearing: turn.bearing.toFixed(0) + '°'
      })
    })

    // Arrival instruction
    instructions.push({
      icon: '🎯',
      text: 'You have arrived at your destination',
      distance: `${Math.round(totalDistance)} m`
    })

    // Ensure we never exceed maxInstructions
    if (instructions.length > maxInstructions) {
      // Keep start, last few important turns, and arrival
      const toKeep = [
        instructions[0], // Start
        ...instructions.slice(-Math.min(5, maxInstructions - 2)), // Last important turns
        instructions[instructions.length - 1] // Arrival
      ]
      return toKeep.slice(0, maxInstructions)
    }

    return instructions
  }

  return {
    calculateDistance,
    calculateBearing,
    getDirection,
    calculateTurnAngle,
    getTurnInstruction,
    getNearestPointOnLine,
    findClickedLineString,
    getPublicRoute,
    buildCampusGraph,
    findNearestNode,
    findPathAStar,
    calculateRouteDistance,
    findCampusEntrances,
    generateEnhancedInstructions
  }
}
