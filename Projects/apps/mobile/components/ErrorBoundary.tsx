import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.error?.message || "Unknown error"}</Text>
            <Pressable style={styles.button} onPress={this.reset}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.error,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: Colors.background,
    fontWeight: "600",
    fontSize: 14,
  },
});
