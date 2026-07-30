export function assignEffectiveScopeOwnership(scopes) {
  const ownershipByPath = new Map()
  for (const scope of scopes) {
    for (const path of scope.matchedPaths) {
      const owners = ownershipByPath.get(path) ?? []
      owners.push({ id: scope.id, ownerPhase: scope.ownerPhase, action: scope.action })
      ownershipByPath.set(path, owners)
    }
  }

  const effectiveOwnerByPath = new Map(
    [...ownershipByPath.entries()].map(([path, owners]) => [
      path,
      [...owners].sort(
        (left, right) => left.ownerPhase - right.ownerPhase || left.id.localeCompare(right.id, 'en')
      )[0]
    ])
  )
  for (const scope of scopes) {
    scope.effectiveOwnedPaths = scope.matchedPaths.filter(
      (path) => effectiveOwnerByPath.get(path)?.id === scope.id
    )
  }

  return [...ownershipByPath.entries()]
    .filter(([, owners]) => owners.length > 1)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([path, owners]) => ({ path, owners, effectiveOwner: effectiveOwnerByPath.get(path) }))
}
