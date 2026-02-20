
/**
 * Calculate straight-line distance between two points (Haversine formula)
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Find the nearest point on a line segment to a given point
 */
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

  return {
    index: nearestIndex,
    coord: coordinates[nearestIndex],
    distance: minDist
  }
}

/**
 * Check if a point is near any private path (LineString)
 */
const findNearestPrivatePath = (point, features, threshold = 50) => {
  let closestFeature = null
  let closestPoint = null
  let minDist = Infinity

  features.forEach((feature) => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates
      const nearest = getNearestPointOnLine(point, coords)

      if (nearest.distance < minDist) {
        minDist = nearest.distance
        closestFeature = feature
        closestPoint = nearest
      }
    }
  })

  return minDist <= threshold ? { feature: closestFeature, point: closestPoint } : null
}

/**
 * Build a simplified graph from GeoJSON features
 * Each LineString becomes a series of connected nodes
 */
const buildCampusGraph = (geojsonFeatures) => {
  const graph = new Map()
  let nodeIdCounter = 0

  geojsonFeatures.forEach((feature) => {
    if (feature.geometry.type !== 'LineString') return

    const coords = feature.geometry.coordinates
    let prevNodeId = null

    coords.forEach(([lng, lat], index) => {
      const nodeId = `node_${nodeIdCounter++}`

      const node = {
        id: nodeId,
        lat,
        lng,
        neighbors: []
      }

      // Connect to previous node (bidirectional)
      if (prevNodeId) {
        const prevNode = graph.get(prevNodeId)
        const distance = calculateDistance(prevNode.lat, prevNode.lng, lat, lng)

        node.neighbors.push({ id: prevNodeId, cost: distance })
        prevNode.neighbors.push({ id: nodeId, cost: distance })
      }

      graph.set(nodeId, node)
      prevNodeId = nodeId
    })
  })

  return graph
}

/**
 * Find the nearest graph node to a given point
 */
const findNearestNode = (point, graph) => {
  let nearestId = null
  let minDist = Infinity

  for (const [nodeId, node] of graph.entries()) {
    const dist = calculateDistance(point.lat, point.lng, node.lat, node.lng)
    if (dist < minDist) {
      minDist = dist
      nearestId = nodeId
    }
  }

  return nearestId
}

/**
 * A* Pathfinding Algorithm - Simplified for campus paths
 */
const findPathAStar = (startId, goalId, graph) => {
  if (!graph.has(startId) || !graph.has(goalId)) {
    console.warn('Start or goal node not in graph')
    return null
  }

  const openSet = new Set([startId])
  const closedSet = new Set()
  const cameFrom = new Map()
  const gScore = new Map([[startId, 0]])
  const fScore = new Map()

  const startNode = graph.get(startId)
  const goalNode = graph.get(goalId)
  fScore.set(startId, calculateDistance(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng))

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = null
    let lowestF = Infinity
    for (const id of openSet) {
      const f = fScore.get(id) || Infinity
      if (f < lowestF) {
        lowestF = f
        current = id
      }
    }

    // Reached goal
    if (current === goalId) {
      return reconstructPath(cameFrom, current, graph)
    }

    openSet.delete(current)
    closedSet.add(current)

    const currentNode = graph.get(current)
    const currentG = gScore.get(current)

    // Check all neighbors
    for (const neighbor of currentNode.neighbors) {
      if (closedSet.has(neighbor.id)) continue

      const tentativeG = currentG + neighbor.cost
      const existingG = gScore.get(neighbor.id) || Infinity

      if (tentativeG < existingG) {
        cameFrom.set(neighbor.id, current)
        gScore.set(neighbor.id, tentativeG)

        const neighborNode = graph.get(neighbor.id)
        const h = calculateDistance(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng)
        fScore.set(neighbor.id, tentativeG + h)

        openSet.add(neighbor.id)
      }
    }
  }

  return null // No path found
}

/**
 * Reconstruct the path from A* result
 */
const reconstructPath = (cameFrom, current, graph) => {
  const path = []

  while (current) {
    const node = graph.get(current)
    path.unshift({ lat: node.lat, lng: node.lng })
    current = cameFrom.get(current)
  }

  return path
}

/**
 * Main routing function - Enhanced for campus navigation
 */
const createCampusRoute = async (userPos, destination, privateRoutes) => {
  let fullRoute = []
  let isPrivatePath = false
  let routeType = 'direct'

  // Build graph from private paths
  const campusGraph = buildCampusGraph(privateRoutes.features)
  console.log(`Built graph with ${campusGraph.size} nodes`)

  // Check if destination is near a private path
  const nearestPath = findNearestPrivatePath(destination, privateRoutes.features, 50)

  if (nearestPath) {
    console.log(' Using private campus path')
    isPrivatePath = true
    routeType = 'campus'

    // Step 1: Route from user to path entry point
    const pathEntry = {
      lat: nearestPath.feature.geometry.coordinates[0][1],
      lng: nearestPath.feature.geometry.coordinates[0][0]
    }

    const publicSegment = await getPublicRoute(userPos, pathEntry)
    if (publicSegment) {
      publicSegment.forEach(p => fullRoute.push([p.lat, p.lng]))
    } else {
      // Direct line if OSRM fails
      fullRoute.push([userPos.lat, userPos.lng])
      fullRoute.push([pathEntry.lat, pathEntry.lng])
    }

    // Step 2: Use A* for optimal path within campus
    const startNodeId = findNearestNode(pathEntry, campusGraph)
    const goalNodeId = findNearestNode(
      { lat: nearestPath.point.coord[1], lng: nearestPath.point.coord[0] },
      campusGraph
    )

    if (startNodeId && goalNodeId) {
      const campusPath = findPathAStar(startNodeId, goalNodeId, campusGraph)

      if (campusPath) {
        console.log(` A* found path with ${campusPath.length} nodes`)
        campusPath.forEach(point => fullRoute.push([point.lat, point.lng]))
      } else {
        // Fallback: follow LineString directly
        console.log('⚠️ A* failed, using direct path')
        for (let i = 0; i <= nearestPath.point.index; i++) {
          const [lng, lat] = nearestPath.feature.geometry.coordinates[i]
          fullRoute.push([lat, lng])
        }
      }
    }

  } else {
    // Public road routing only
    console.log('Using public roads')
    routeType = 'public'

    const publicRoute = await getPublicRoute(userPos, destination)

    if (publicRoute) {
      publicRoute.forEach(p => fullRoute.push([p.lat, p.lng]))
    } else {
      // Fallback: try campus graph even for public routes
      console.log('⚠️ OSRM failed, trying campus graph fallback')

      const startNodeId = findNearestNode(userPos, campusGraph)
      const goalNodeId = findNearestNode(destination, campusGraph)

      if (startNodeId && goalNodeId) {
        const campusPath = findPathAStar(startNodeId, goalNodeId, campusGraph)
        if (campusPath) {
          campusPath.forEach(point => fullRoute.push([point.lat, point.lng]))
          isPrivatePath = true
          routeType = 'campus_fallback'
        }
      }

      // Last resort: direct line
      if (fullRoute.length === 0) {
        fullRoute.push([userPos.lat, userPos.lng])
        fullRoute.push([destination.lat, destination.lng])
      }
    }
  }

  return {
    route: fullRoute,
    isPrivatePath,
    routeType
  }
}

const getPublicRoute = async (start, end) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    const response = await fetch(url)
    const data = await response.json()

    if (data.code === 'Ok' && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates
      return coords.map(([lng, lat]) => ({ lat, lng }))
    }
  } catch (err) {
    console.error('OSRM error:', err)
  }
  return null
}

// Export functions
export {
  calculateDistance,
  buildCampusGraph,
  findPathAStar,
  createCampusRoute,
  findNearestPrivatePath,
  findNearestNode
}
