import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Guards a form screen against losing unsaved changes.
 *
 * While `isDirty` is true it (1) disables the iOS modal swipe-dismiss gesture —
 * a guard with a swipe bypass is not a guard — and (2) intercepts every removal
 * (Android hardware-back, the native header close, programmatic `router.back()`)
 * with a "Discard changes?" confirmation.
 *
 * Returns `markSaved`: call it immediately before navigating away on a
 * successful save so the guard lets that programmatic exit through without a
 * spurious discard prompt (the form state is still "dirty" at that point — no
 * React render can flush between the save and the synchronous `router.back()`).
 */
export function useUnsavedChangesGuard(isDirty: boolean): () => void {
  const navigation = useNavigation();
  const savedRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isDirty });
  }, [isDirty, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!isDirty || savedRef.current) return;
      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Discard them?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [isDirty, navigation]);

  return useCallback(() => {
    savedRef.current = true;
  }, []);
}
